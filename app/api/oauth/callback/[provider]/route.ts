import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/api";
import { tryGetIntegration } from "@/lib/integrations/registry";
import { persistTokens } from "@/lib/sync/connection-context";
import { callbackUrl, appUrl } from "@/lib/urls";

/**
 * OAuth callback.
 *
 * Failures redirect back to the connections page with a readable message rather
 * than rendering JSON at the user, because this URL is somewhere a person lands
 * in their browser, not an endpoint a client calls.
 */
function back(message: string, kind: "error" | "success" = "error") {
  const url = new URL("/dashboard/connections", appUrl());
  url.searchParams.set(kind === "error" ? "error" : "connected", message);
  return NextResponse.redirect(url.toString());
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    return back(
      providerError === "access_denied"
        ? "You cancelled that connection, so nothing was changed."
        : "That service declined the connection. Please try again.",
    );
  }

  const session = await getSession();
  if (!session) return back("Your session expired before that finished. Sign in and try again.");

  if (!code || !state) return back("That connection did not complete. Please try again.");

  const stored = await db.oAuthState.findUnique({ where: { state } });
  // A state we did not issue, or one already consumed, means this callback is
  // not the one we started. Refuse it.
  if (!stored || stored.provider !== provider || stored.orgId !== session.orgId) {
    return back("That connection could not be verified. Please start again.");
  }
  if (stored.expiresAt < new Date()) {
    await db.oAuthState.delete({ where: { id: stored.id } }).catch(() => {});
    return back("That connection attempt timed out. Please try again.");
  }

  // Single use.
  await db.oAuthState.delete({ where: { id: stored.id } }).catch(() => {});

  const integration = tryGetIntegration(provider);
  if (!integration) return back("That service is not recognised.");

  try {
    const token = await integration.completeAuthentication({
      code,
      redirectUri: callbackUrl(provider),
      codeVerifier: stored.codeVerifier ?? undefined,
    });

    const externalId = token.externalId ?? "default";

    const connection = await db.connection.upsert({
      where: {
        orgId_provider_externalId: { orgId: session.orgId, provider, externalId },
      },
      create: {
        orgId: session.orgId,
        provider,
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
        scopes: token.scopes ?? [],
      },
    });

    await persistTokens(connection.id, token);

    await writeAudit({
      orgId: session.orgId,
      userId: session.id,
      action: "connection.created",
      target: connection.id,
      metadata: { provider, accountLabel: token.accountLabel },
    });

    await db.syncEvent.create({
      data: {
        orgId: session.orgId,
        connectionId: connection.id,
        level: "SUCCESS",
        title: `${integration.descriptor.name} connected`,
        detail: token.accountLabel ? `Connected as ${token.accountLabel}.` : undefined,
      },
    });

    return back(integration.descriptor.name, "success");
  } catch (error) {
    const message =
      error && typeof error === "object" && "userMessage" in error
        ? String((error as { userMessage: string }).userMessage)
        : "That connection could not be completed. Please try again.";
    console.error(`[oauth callback ${provider}]`, error);
    return back(message);
  }
}
