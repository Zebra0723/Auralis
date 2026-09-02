import { createHash, randomBytes } from "node:crypto";
import {
  IntegrationError,
  type AuthorizeRequest,
  type TokenSet,
} from "@/lib/integrations/types";

/**
 * Shared OAuth 2.0 authorisation-code machinery.
 *
 * Every OAuth provider in the registry composes this rather than reimplementing
 * the flow, so a fix to token handling (clock skew, refresh rotation, error
 * mapping) lands everywhere at once.
 */

export interface OAuth2Config {
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  usePkce?: boolean;
  /** Providers differ: some want these, some reject them. */
  extraAuthorizeParams?: Record<string, string>;
  /** Basic auth on the token endpoint instead of body credentials. */
  tokenAuthStyle?: "body" | "basic";
}

export function generatePkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function providerConfigured(cfg: OAuth2Config): boolean {
  return Boolean(process.env[cfg.clientIdEnv] && process.env[cfg.clientSecretEnv]);
}

function credentials(cfg: OAuth2Config) {
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) {
    throw new IntegrationError({
      code: "not_configured",
      userMessage:
        "This service has not been configured yet. An administrator needs to add " +
        `${cfg.clientIdEnv} and ${cfg.clientSecretEnv} before it can be connected.`,
      retryable: false,
    });
  }
  return { clientId, clientSecret };
}

export function buildAuthorizeUrl(cfg: OAuth2Config, req: AuthorizeRequest): string {
  const { clientId } = credentials(cfg);
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", req.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", req.state);
  if (cfg.scopes.length) url.searchParams.set("scope", cfg.scopes.join(" "));
  for (const [k, v] of Object.entries(cfg.extraAuthorizeParams ?? {})) {
    url.searchParams.set(k, v);
  }
  if (cfg.usePkce && req.codeVerifier) {
    url.searchParams.set(
      "code_challenge",
      createHash("sha256").update(req.codeVerifier).digest("base64url"),
    );
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
  [k: string]: unknown;
}

async function postToken(
  cfg: OAuth2Config,
  body: Record<string, string>,
): Promise<TokenSet> {
  const { clientId, clientSecret } = credentials(cfg);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  const params = new URLSearchParams(body);

  if (cfg.tokenAuthStyle === "basic") {
    headers.Authorization =
      "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  } else {
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
  }

  let res: Response;
  try {
    res = await fetch(cfg.tokenUrl, { method: "POST", headers, body: params });
  } catch (cause) {
    throw new IntegrationError({
      code: "network",
      userMessage: "We could not reach this service. We will try again shortly.",
      message: String(cause),
      retryable: true,
    });
  }

  const text = await res.text();
  let json: RawTokenResponse;
  try {
    json = JSON.parse(text) as RawTokenResponse;
  } catch {
    // A few providers still answer form-encoded (GitHub without an Accept header).
    json = Object.fromEntries(new URLSearchParams(text)) as RawTokenResponse;
  }

  if (!res.ok || json.error || !json.access_token) {
    const detail = json.error_description || json.error || text.slice(0, 200);
    throw new IntegrationError({
      code: res.status === 401 ? "auth_invalid" : "provider_error",
      userMessage:
        "That connection attempt was rejected by the service. Try connecting again.",
      message: `Token endpoint ${res.status}: ${detail}`,
      status: res.status,
      retryable: res.status >= 500,
    });
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    tokenType: json.token_type ?? "Bearer",
    expiresAt: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000)
      : null,
    scopes: json.scope ? String(json.scope).split(/[\s,]+/).filter(Boolean) : [],
  };
}

export function exchangeCode(
  cfg: OAuth2Config,
  params: { code: string; redirectUri: string; codeVerifier?: string },
): Promise<TokenSet> {
  const body: Record<string, string> = {
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  };
  if (cfg.usePkce && params.codeVerifier) body.code_verifier = params.codeVerifier;
  return postToken(cfg, body);
}

export async function refreshAccessToken(
  cfg: OAuth2Config,
  refreshToken: string | null | undefined,
): Promise<TokenSet> {
  if (!refreshToken) {
    throw new IntegrationError({
      code: "auth_expired",
      userMessage:
        "This connection has expired and cannot renew itself. Reconnect it to resume syncing.",
      retryable: false,
    });
  }
  const next = await postToken(cfg, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  // Providers that do not rotate refresh tokens omit it; keep the existing one.
  return { ...next, refreshToken: next.refreshToken ?? refreshToken };
}

/* ----------------------------------------------------------- HTTP helper */

/**
 * Wrapper around fetch that turns provider HTTP semantics into IntegrationError,
 * so callers never have to interpret a raw status code.
 */
export async function apiFetch<T>(
  url: string,
  init: RequestInit & { accessToken?: string; providerName: string },
): Promise<T> {
  const { accessToken, providerName, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers });
  } catch (cause) {
    throw new IntegrationError({
      code: "network",
      userMessage: `We could not reach ${providerName}. We will retry automatically.`,
      message: String(cause),
      retryable: true,
    });
  }

  if (res.status === 401 || res.status === 403) {
    throw new IntegrationError({
      code: "auth_expired",
      userMessage: `Your ${providerName} connection has expired. Reconnect ${providerName} to continue syncing.`,
      message: `${res.status} from ${url}`,
      status: res.status,
      retryable: false,
    });
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after")) || 60;
    throw new IntegrationError({
      code: "rate_limited",
      userMessage: `${providerName} is asking us to slow down. This sync will resume shortly.`,
      status: 429,
      retryable: true,
      retryAfterMs: retryAfter * 1000,
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new IntegrationError({
      code: "provider_error",
      userMessage: `${providerName} rejected the request. We will retry, and will let you know if it keeps failing.`,
      message: `${res.status} from ${url}: ${body.slice(0, 300)}`,
      status: res.status,
      retryable: res.status >= 500,
    });
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
