import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, fail, handleError, planFor, withinLimit } from "@/lib/api";
import { connectableState, tryGetIntegration } from "@/lib/integrations/registry";
import { generatePkcePair } from "@/lib/integrations/oauth2";
import { randomToken } from "@/lib/crypto";
import { callbackUrl } from "@/lib/urls";

/**
 * Begins an OAuth authorisation.
 *
 * The state parameter is a random value stored server-side with a short expiry,
 * so a callback carrying a state we did not issue is rejected. The PKCE verifier
 * lives in the same row rather than in a cookie, which keeps it out of reach of
 * anything running in the browser.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { provider } = await params;
  const integration = tryGetIntegration(provider);
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
    const stateToken = randomToken(24);
    const { verifier } = generatePkcePair();

    await db.oAuthState.create({
      data: {
        state: stateToken,
        orgId: auth.user.orgId,
        provider,
        codeVerifier: verifier,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    const result = await integration.authenticate({
      state: stateToken,
      redirectUri: callbackUrl(provider),
      codeVerifier: verifier,
    });

    if ("needsToken" in result) {
      return fail(
        `${integration.descriptor.name} is connected with an access token rather than a redirect.`,
        400,
        "needs_token",
      );
    }

    return NextResponse.redirect(result.redirectUrl);
  } catch (error) {
    return handleError(error, `oauth start ${provider}`);
  }
}
