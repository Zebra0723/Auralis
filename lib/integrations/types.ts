/**
 * The contract every integration implements.
 *
 * Adding a provider means writing one file that exports a ProviderDescriptor
 * and an Integration, then registering it. No sync-engine, queue, or UI code
 * changes: the engine only ever talks to this interface, and the UI renders
 * whatever the descriptor's capabilities declare.
 */

export type FieldType = "string" | "email" | "url" | "phone" | "text" | "image";

export type RecordType = "profile" | "contact";

export interface FieldSpec {
  /** Canonical key. Providers map their own naming onto this. */
  key: string;
  label: string;
  type: FieldType;
  /**
   * False when the provider exposes the field read-only. The sync planner uses
   * this to refuse impossible destinations up front rather than failing at
   * write time with a confusing API error.
   */
  writable: boolean;
  description?: string;
}

export interface ProviderCapabilities {
  recordTypes: RecordType[];
  fields: Partial<Record<RecordType, FieldSpec[]>>;
  supportsWebhooks: boolean;
  supportsDelete: boolean;
  /** Documented API ceiling, used by the queue to pace requests. */
  rateLimitPerMinute?: number;
}

export type AuthMethod = "oauth2" | "token" | "internal";

/**
 * "available" — an adapter exists and will work once any required env vars are set.
 * "planned"   — no adapter yet; surfaced in the UI as Coming soon and not connectable.
 */
export type ProviderStatus = "available" | "planned";

export interface ProviderDescriptor {
  key: string;
  name: string;
  category: string;
  blurb: string;
  authMethod: AuthMethod;
  status: ProviderStatus;
  /** Env vars that must be present for this provider to be connectable. */
  requiredEnv: string[];
  /** Where an operator goes to create the OAuth app / token. */
  setupUrl?: string;
  setupHint?: string;
  docsUrl?: string;
  capabilities: ProviderCapabilities;
  /** Brand tint for the icon chip. */
  accent: string;
  /** Single-glyph mark used when no logo asset is present. */
  mark: string;
}

/** Everything an adapter needs to talk to one connected account. */
export interface IntegrationContext {
  connectionId: string;
  orgId: string;
  accessToken: string;
  refreshToken?: string | null;
  externalId?: string | null;
}

/** A record as it exists at the provider, already mapped to canonical keys. */
export interface RemoteRecord {
  externalId: string;
  recordType: RecordType;
  /** Canonical field key to value. Absent keys mean "provider did not return it". */
  fields: Record<string, string | null>;
  updatedAt?: Date | null;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  expiresAt?: Date | null;
  scopes?: string[];
  externalId?: string | null;
  accountLabel?: string | null;
}

export interface AuthorizeRequest {
  state: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface WebhookSubscription {
  supported: boolean;
  subscriptionId?: string;
  expiresAt?: Date | null;
  reason?: string;
}

export interface Integration {
  descriptor: ProviderDescriptor;

  /** Step one of connecting: where to send the user, or how to accept a token. */
  authenticate(req: AuthorizeRequest): Promise<{ redirectUrl: string } | { needsToken: true }>;

  /** Exchange an OAuth callback code (or a pasted token) for a stored TokenSet. */
  completeAuthentication(params: {
    code?: string;
    token?: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<TokenSet>;

  refreshToken(ctx: IntegrationContext): Promise<TokenSet>;

  getData(ctx: IntegrationContext, recordType: RecordType): Promise<RemoteRecord[]>;

  updateData(
    ctx: IntegrationContext,
    recordType: RecordType,
    externalId: string,
    patch: Record<string, string | null>,
  ): Promise<RemoteRecord>;

  deleteData(
    ctx: IntegrationContext,
    recordType: RecordType,
    externalId: string,
  ): Promise<void>;

  subscribeToChanges(
    ctx: IntegrationContext,
    callbackUrl: string,
  ): Promise<WebhookSubscription>;

  disconnect(ctx: IntegrationContext): Promise<void>;
}

/* ------------------------------------------------------------------ errors */

export type IntegrationErrorCode =
  | "auth_expired"
  | "auth_invalid"
  | "rate_limited"
  | "not_configured"
  | "unsupported"
  | "provider_error"
  | "network";

/**
 * Errors carry a message written for the person who owns the connection, not
 * for a log aggregator. `retryable` drives the queue's backoff decision.
 */
export class IntegrationError extends Error {
  code: IntegrationErrorCode;
  userMessage: string;
  retryable: boolean;
  retryAfterMs?: number;
  status?: number;

  constructor(params: {
    code: IntegrationErrorCode;
    userMessage: string;
    message?: string;
    retryable?: boolean;
    retryAfterMs?: number;
    status?: number;
  }) {
    super(params.message ?? params.userMessage);
    this.name = "IntegrationError";
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.retryable = params.retryable ?? false;
    this.retryAfterMs = params.retryAfterMs;
    this.status = params.status;
  }
}

export function isAuthError(e: unknown): boolean {
  return (
    e instanceof IntegrationError &&
    (e.code === "auth_expired" || e.code === "auth_invalid")
  );
}
