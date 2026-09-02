import { z } from "zod";
import { db } from "@/lib/db";
import {
  fail,
  handleError,
  ok,
  parseBody,
  planFor,
  requireUser,
  withinLimit,
  writeAudit,
} from "@/lib/api";
import { allDescriptors, connectableState, tryGetIntegration } from "@/lib/integrations/registry";
import { persistTokens } from "@/lib/sync/connection-context";

/**
 * GET /api/connections — the workspace's connections plus the full catalogue.
 *
 * Credentials are deliberately absent from this shape. No route serialises
 * OAuthCredential, so a token cannot reach the browser through the API.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const connections = await db.connection.findMany({
    where: { orgId: auth.user.orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      provider: true,
      displayName: true,
      accountLabel: true,
      status: true,
      statusDetail: true,
      scopes: true,
      lastSyncedAt: true,
      createdAt: true,
    },
  });

  const catalogue = allDescriptors().map((descriptor) => {
    const state = connectableState(descriptor);
    return {
      key: descriptor.key,
      name: descriptor.name,
      category: descriptor.category,
      blurb: descriptor.blurb,
      authMethod: descriptor.authMethod,
      accent: descriptor.accent,
      mark: descriptor.mark,
      setupUrl: descriptor.setupUrl,
      setupHint: descriptor.setupHint,
      docsUrl: descriptor.docsUrl,
      status: descriptor.status,
      connectable: state.connectable,
      unavailableReason: state.connectable ? null : state.reason,
      missingEnv: state.connectable ? [] : state.missingEnv,
      recordTypes: descriptor.capabilities.recordTypes,
      fields: descriptor.capabilities.fields,
      supportsWebhooks: descriptor.capabilities.supportsWebhooks,
    };
  });

  return ok({ connections, catalogue });
}

const connectSchema = z.object({
  provider: z.string().min(1),
  /** Only for providers authenticated with a user-supplied token. */
  token: z.string().min(1).max(500).optional(),
});

/** POST /api/connections — connect a token-based provider, or the internal Vault. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, connectSchema);
  if (!body.ok) return body.response;

  const integration = tryGetIntegration(body.data.provider);
  if (!integration) return fail("That service is not recognised.", 404, "unknown_provider");

  const state = connectableState(integration.descriptor);
  if (!state.connectable) {
    return fail(
      state.reason === "planned"
        ? `${integration.descriptor.name} is not available yet.`
        : `${integration.descriptor.name} needs API credentials before it can be connected. Missing: ${state.missingEnv.join(", ")}.`,
      503,
      state.reason,
    );
  }

  if (integration.descriptor.authMethod === "oauth2") {
    return fail(
      `${integration.descriptor.name} is connected by authorising it, not by pasting a token.`,
      400,
      "use_oauth",
    );
  }

  const plan = await planFor(auth.user.orgId);
  const existing = await db.connection.count({ where: { orgId: auth.user.orgId } });
  if (!withinLimit(existing, plan.maxConnections)) {
    return fail(
      `Your ${plan.name} plan includes ${plan.maxConnections} connections. Upgrade to connect more.`,
      402,
      "limit_reached",
    );
  }

  try {
    // A token provider verifies the credential against the live API here, so an
    // invalid token fails at connect time rather than at first sync.
    const token = await integration.completeAuthentication({
      token: body.data.token,
      redirectUri: "",
    });

    const externalId = token.externalId ?? "default";

    const connection = await db.connection.upsert({
      where: {
        orgId_provider_externalId: {
          orgId: auth.user.orgId,
          provider: body.data.provider,
          externalId,
        },
      },
      create: {
        orgId: auth.user.orgId,
        provider: body.data.provider,
        displayName: integration.descriptor.name,
        externalId,
        accountLabel: token.accountLabel ?? null,
        scopes: token.scopes ?? [],
        status: "ACTIVE",
      },
      update: {
        status: "ACTIVE",
        statusDetail: null,
        accountLabel: token.accountLabel ?? null,
      },
    });

    await persistTokens(connection.id, token);

    await writeAudit({
      orgId: auth.user.orgId,
      userId: auth.user.id,
      action: "connection.created",
      target: connection.id,
      metadata: { provider: body.data.provider },
    });

    await db.syncEvent.create({
      data: {
        orgId: auth.user.orgId,
        connectionId: connection.id,
        level: "SUCCESS",
        title: `${integration.descriptor.name} connected`,
        detail: token.accountLabel ? `Connected as ${token.accountLabel}.` : undefined,
      },
    });

    return ok({
      id: connection.id,
      provider: connection.provider,
      accountLabel: connection.accountLabel,
    });
  } catch (error) {
    return handleError(error, `connect ${body.data.provider}`);
  }
}
