import { defineOAuthProvider } from "@/lib/integrations/base";
import { apiFetch, type OAuth2Config } from "@/lib/integrations/oauth2";
import { fields } from "@/lib/integrations/fields";
import {
  IntegrationError,
  type Integration,
  type IntegrationContext,
  type ProviderDescriptor,
  type RemoteRecord,
} from "@/lib/integrations/types";

const API = "https://slack.com/api";

export const slackOAuth: OAuth2Config = {
  authorizeUrl: "https://slack.com/oauth/v2/authorize",
  tokenUrl: `${API}/oauth.v2.access`,
  clientIdEnv: "SLACK_CLIENT_ID",
  clientSecretEnv: "SLACK_CLIENT_SECRET",
  scopes: [],
  // Profile reads and writes need a *user* token, which Slack only issues for
  // scopes requested via user_scope rather than scope.
  extraAuthorizeParams: {
    user_scope: "users.profile:read,users.profile:write,users:read.email",
  },
};

export const slackDescriptor: ProviderDescriptor = {
  key: "slack",
  name: "Slack",
  category: "Communication",
  blurb: "Keep your Slack display name, title, phone and pronouns aligned with the rest of your accounts.",
  authMethod: "oauth2",
  status: "available",
  requiredEnv: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
  setupUrl: "https://api.slack.com/apps",
  setupHint:
    "Create a Slack app, add the Auralis callback under OAuth & Permissions → Redirect URLs, and request the user scopes users.profile:read and users.profile:write.",
  docsUrl: "https://api.slack.com/methods/users.profile.set",
  accent: "#611f69",
  mark: "S",
  capabilities: {
    recordTypes: ["profile"],
    fields: {
      profile: fields(
        ["displayName", "firstName", "lastName", "email", "phone", "jobTitle", "avatarUrl", "pronouns"],
        ["displayName", "firstName", "lastName", "phone", "jobTitle", "pronouns"],
      ),
    },
    supportsWebhooks: true,
    supportsDelete: false,
    rateLimitPerMinute: 50,
  },
};

interface SlackProfile {
  real_name?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  image_192?: string;
  pronouns?: string;
}

/** Slack answers 200 with `ok:false` for logical failures, so status alone is not enough. */
async function slackCall<T extends { ok: boolean; error?: string }>(
  url: string,
  ctx: { accessToken: string },
  init?: RequestInit,
): Promise<T> {
  const res = await apiFetch<T>(url, {
    ...init,
    accessToken: ctx.accessToken,
    providerName: "Slack",
  });
  if (!res.ok) {
    const err = res.error ?? "unknown_error";
    if (err === "invalid_auth" || err === "token_revoked" || err === "not_authed") {
      throw new IntegrationError({
        code: "auth_expired",
        userMessage: "Your Slack connection has expired. Reconnect Slack to continue syncing.",
        message: err,
        retryable: false,
      });
    }
    if (err === "ratelimited") {
      throw new IntegrationError({
        code: "rate_limited",
        userMessage: "Slack is asking us to slow down. This sync will resume shortly.",
        retryable: true,
        retryAfterMs: 60_000,
      });
    }
    throw new IntegrationError({
      code: "provider_error",
      userMessage: "Slack rejected the request. We will retry automatically.",
      message: err,
      retryable: false,
    });
  }
  return res;
}

function toRecord(userId: string, p: SlackProfile): RemoteRecord {
  return {
    externalId: userId,
    recordType: "profile",
    fields: {
      displayName: p.display_name || p.real_name || null,
      firstName: p.first_name ?? null,
      lastName: p.last_name ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      jobTitle: p.title ?? null,
      avatarUrl: p.image_192 ?? null,
      pronouns: p.pronouns ?? null,
    },
    updatedAt: null,
  };
}

const WRITE_MAP: Record<string, string> = {
  displayName: "display_name",
  firstName: "first_name",
  lastName: "last_name",
  phone: "phone",
  jobTitle: "title",
  pronouns: "pronouns",
};

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  const res = await slackCall<{ ok: boolean; error?: string; profile: SlackProfile }>(
    `${API}/users.profile.get`,
    ctx,
  );
  return [toRecord(ctx.externalId ?? "me", res.profile)];
}

async function writeProfile(
  ctx: IntegrationContext,
  _externalId: string,
  patch: Record<string, string | null>,
): Promise<RemoteRecord> {
  const profile: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch)) {
    const remote = WRITE_MAP[key];
    if (remote) profile[remote] = value ?? "";
  }
  const res = await slackCall<{ ok: boolean; error?: string; profile: SlackProfile }>(
    `${API}/users.profile.set`,
    ctx,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ profile }),
    },
  );
  return toRecord(ctx.externalId ?? "me", res.profile);
}

const base = defineOAuthProvider({
  descriptor: slackDescriptor,
  oauth: slackOAuth,
  handlers: {
    readers: { profile: readProfile },
    writers: { profile: writeProfile },
  },
});

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  authed_user?: { id: string; access_token?: string; scope?: string; token_type?: string };
  team?: { name?: string };
}

export const slackIntegration: Integration = {
  ...base,
  /**
   * Slack nests the user token under `authed_user` rather than returning it at
   * the top level, so the generic exchange cannot be reused here.
   */
  async completeAuthentication({ code, redirectUri }) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new IntegrationError({
        code: "not_configured",
        userMessage:
          "Slack has not been configured yet. An administrator needs to add SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.",
        retryable: false,
      });
    }
    if (!code) {
      throw new IntegrationError({
        code: "auth_invalid",
        userMessage: "That connection attempt did not complete. Please try again.",
        retryable: false,
      });
    }

    const res = (await (
      await fetch(slackOAuth.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })
    ).json()) as SlackOAuthResponse;

    const userToken = res.authed_user?.access_token;
    if (!res.ok || !userToken) {
      throw new IntegrationError({
        code: "auth_invalid",
        userMessage: "Slack declined that connection. Please try again.",
        message: res.error ?? "no user token returned",
        retryable: false,
      });
    }

    return {
      accessToken: userToken,
      refreshToken: null,
      tokenType: res.authed_user?.token_type ?? "Bearer",
      expiresAt: null,
      scopes: res.authed_user?.scope?.split(",") ?? [],
      externalId: res.authed_user?.id ?? null,
      accountLabel: res.team?.name ? `${res.team.name} workspace` : "Slack account",
    };
  },
};
