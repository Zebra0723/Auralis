import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getIntegration } from "@/lib/integrations/registry";
import {
  IntegrationError,
  type IntegrationContext,
  type TokenSet,
} from "@/lib/integrations/types";
import type { Connection } from "@prisma/client";

/** Refresh this far before actual expiry to absorb clock skew and slow calls. */
const REFRESH_MARGIN_MS = 120_000;

export async function persistTokens(
  connectionId: string,
  token: TokenSet,
): Promise<void> {
  const data = {
    accessTokenCipher: encryptSecret(token.accessToken),
    refreshTokenCipher: token.refreshToken ? encryptSecret(token.refreshToken) : null,
    tokenType: token.tokenType ?? "Bearer",
    expiresAt: token.expiresAt ?? null,
  };
  await db.oAuthCredential.upsert({
    where: { connectionId },
    create: { connectionId, ...data },
    update: data,
  });
}

/**
 * Loads a connection's credentials, refreshing them first if they are close to
 * expiry. Returns the context adapters need — and nothing else, so decrypted
 * tokens never travel further than they must.
 */
export async function getConnectionContext(
  connection: Connection,
): Promise<IntegrationContext> {
  const credential = await db.oAuthCredential.findUnique({
    where: { connectionId: connection.id },
  });

  if (!credential) {
    throw new IntegrationError({
      code: "auth_invalid",
      userMessage: `Your ${connection.displayName} connection is missing its credentials. Reconnect it to continue syncing.`,
      retryable: false,
    });
  }

  let accessToken = decryptSecret(credential.accessTokenCipher);
  let refreshToken = credential.refreshTokenCipher
    ? decryptSecret(credential.refreshTokenCipher)
    : null;

  const expiringSoon =
    credential.expiresAt !== null &&
    credential.expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;

  if (expiringSoon && refreshToken) {
    const integration = getIntegration(connection.provider);
    const refreshed = await integration.refreshToken({
      connectionId: connection.id,
      orgId: connection.orgId,
      accessToken,
      refreshToken,
      externalId: connection.externalId,
    });
    await persistTokens(connection.id, refreshed);
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken ?? refreshToken;
  } else if (expiringSoon && !refreshToken) {
    throw new IntegrationError({
      code: "auth_expired",
      userMessage: `Your ${connection.displayName} connection has expired. Reconnect ${connection.displayName} to continue syncing.`,
      retryable: false,
    });
  }

  return {
    connectionId: connection.id,
    orgId: connection.orgId,
    accessToken,
    refreshToken,
    externalId: connection.externalId,
  };
}

/**
 * Records an authentication failure on the connection so the dashboard can ask
 * the user to reconnect, instead of silently retrying forever.
 */
export async function markConnectionNeedsReauth(
  connectionId: string,
  userMessage: string,
): Promise<void> {
  await db.connection.update({
    where: { id: connectionId },
    data: { status: "NEEDS_REAUTH", statusDetail: userMessage },
  });
}
