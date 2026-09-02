import {
  buildAuthorizeUrl,
  exchangeCode,
  providerConfigured,
  refreshAccessToken,
  type OAuth2Config,
} from "@/lib/integrations/oauth2";
import {
  IntegrationError,
  type AuthorizeRequest,
  type Integration,
  type IntegrationContext,
  type ProviderDescriptor,
  type RecordType,
  type RemoteRecord,
  type TokenSet,
  type WebhookSubscription,
} from "@/lib/integrations/types";

/**
 * Provider authors supply only the parts that differ between services: how to
 * read a record, how to write one, and how to identify the account. Everything
 * structural (authorise, exchange, refresh, revoke, error shape) comes from here.
 */
export interface ProviderHandlers {
  /** Read records of a type. Providers that do not support a type simply omit it. */
  readers: Partial<
    Record<RecordType, (ctx: IntegrationContext) => Promise<RemoteRecord[]>>
  >;
  writers?: Partial<
    Record<
      RecordType,
      (
        ctx: IntegrationContext,
        externalId: string,
        patch: Record<string, string | null>,
      ) => Promise<RemoteRecord>
    >
  >;
  deleters?: Partial<
    Record<RecordType, (ctx: IntegrationContext, externalId: string) => Promise<void>>
  >;
  /** Called after token exchange to label the connection in the UI. */
  identify?: (token: TokenSet) => Promise<{ externalId: string; accountLabel: string }>;
  subscribe?: (
    ctx: IntegrationContext,
    callbackUrl: string,
  ) => Promise<WebhookSubscription>;
  revoke?: (ctx: IntegrationContext) => Promise<void>;
}

function unsupported(descriptor: ProviderDescriptor, what: string): IntegrationError {
  return new IntegrationError({
    code: "unsupported",
    userMessage: `${descriptor.name} does not support ${what}.`,
    retryable: false,
  });
}

export function defineOAuthProvider(params: {
  descriptor: ProviderDescriptor;
  oauth: OAuth2Config;
  handlers: ProviderHandlers;
}): Integration {
  const { descriptor, oauth, handlers } = params;

  return {
    descriptor,

    async authenticate(req: AuthorizeRequest) {
      return { redirectUrl: buildAuthorizeUrl(oauth, req) };
    },

    async completeAuthentication({ code, redirectUri, codeVerifier }) {
      if (!code) {
        throw new IntegrationError({
          code: "auth_invalid",
          userMessage: "That connection attempt did not complete. Please try again.",
          retryable: false,
        });
      }
      const token = await exchangeCode(oauth, { code, redirectUri, codeVerifier });
      if (handlers.identify) {
        const id = await handlers.identify(token);
        return { ...token, ...id };
      }
      return token;
    },

    async refreshToken(ctx) {
      return refreshAccessToken(oauth, ctx.refreshToken);
    },

    async getData(ctx, recordType) {
      const reader = handlers.readers[recordType];
      if (!reader) throw unsupported(descriptor, `reading ${recordType} records`);
      return reader(ctx);
    },

    async updateData(ctx, recordType, externalId, patch) {
      const writer = handlers.writers?.[recordType];
      if (!writer) throw unsupported(descriptor, `writing ${recordType} records`);
      return writer(ctx, externalId, patch);
    },

    async deleteData(ctx, recordType, externalId) {
      const deleter = handlers.deleters?.[recordType];
      if (!deleter) throw unsupported(descriptor, `deleting ${recordType} records`);
      return deleter(ctx, externalId);
    },

    async subscribeToChanges(ctx, callbackUrl) {
      if (!handlers.subscribe) {
        return {
          supported: false,
          reason: `${descriptor.name} does not offer change notifications for these records, so Auralis polls on your chosen schedule instead.`,
        };
      }
      return handlers.subscribe(ctx, callbackUrl);
    },

    async disconnect(ctx) {
      // Best effort: a provider that will not revoke should not block the user
      // from removing the connection on our side.
      if (handlers.revoke) {
        try {
          await handlers.revoke(ctx);
        } catch {
          /* connection is removed locally regardless */
        }
      }
    },
  };
}

/**
 * For services authenticated with a user-supplied token (a GitHub PAT, a Trello
 * key/token pair) rather than a redirect flow.
 */
export function defineTokenProvider(params: {
  descriptor: ProviderDescriptor;
  handlers: ProviderHandlers;
  /** Validate the pasted token and return account identity, or throw. */
  verify: (token: string) => Promise<{ externalId: string; accountLabel: string; scopes?: string[] }>;
}): Integration {
  const { descriptor, handlers, verify } = params;

  return {
    descriptor,

    async authenticate() {
      return { needsToken: true as const };
    },

    async completeAuthentication({ token }) {
      if (!token) {
        throw new IntegrationError({
          code: "auth_invalid",
          userMessage: "Paste an access token to connect this service.",
          retryable: false,
        });
      }
      const identity = await verify(token.trim());
      return {
        accessToken: token.trim(),
        refreshToken: null,
        tokenType: "Bearer",
        expiresAt: null,
        ...identity,
      };
    },

    async refreshToken() {
      // A user-supplied token has no refresh path; it is valid until revoked.
      throw new IntegrationError({
        code: "auth_expired",
        userMessage: `Your ${descriptor.name} token is no longer valid. Reconnect ${descriptor.name} with a new token.`,
        retryable: false,
      });
    },

    async getData(ctx, recordType) {
      const reader = handlers.readers[recordType];
      if (!reader) throw unsupported(descriptor, `reading ${recordType} records`);
      return reader(ctx);
    },

    async updateData(ctx, recordType, externalId, patch) {
      const writer = handlers.writers?.[recordType];
      if (!writer) throw unsupported(descriptor, `writing ${recordType} records`);
      return writer(ctx, externalId, patch);
    },

    async deleteData(ctx, recordType, externalId) {
      const deleter = handlers.deleters?.[recordType];
      if (!deleter) throw unsupported(descriptor, `deleting ${recordType} records`);
      return deleter(ctx, externalId);
    },

    async subscribeToChanges(ctx, callbackUrl) {
      if (!handlers.subscribe) {
        return {
          supported: false,
          reason: `${descriptor.name} changes are picked up on your chosen schedule.`,
        };
      }
      return handlers.subscribe(ctx, callbackUrl);
    },

    async disconnect(ctx) {
      if (handlers.revoke) {
        try {
          await handlers.revoke(ctx);
        } catch {
          /* removed locally regardless */
        }
      }
    },
  };
}

/**
 * A provider listed in the marketplace with no adapter yet. It exists so the UI
 * can show it honestly as Coming soon; every operation refuses rather than
 * pretending to succeed.
 */
export function definePlannedProvider(descriptor: ProviderDescriptor): Integration {
  const refuse = (): never => {
    throw new IntegrationError({
      code: "unsupported",
      userMessage: `${descriptor.name} is not available yet. We will let you know when it is ready.`,
      retryable: false,
    });
  };

  return {
    descriptor,
    authenticate: async () => refuse(),
    completeAuthentication: async () => refuse(),
    refreshToken: async () => refuse(),
    getData: async () => refuse(),
    updateData: async () => refuse(),
    deleteData: async () => refuse(),
    subscribeToChanges: async () => ({
      supported: false,
      reason: "Not available yet.",
    }),
    disconnect: async () => {},
  };
}

export { providerConfigured };
