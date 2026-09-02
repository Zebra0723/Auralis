import { defineTokenProvider } from "@/lib/integrations/base";
import { apiFetch } from "@/lib/integrations/oauth2";
import { fields } from "@/lib/integrations/fields";
import {
  IntegrationError,
  type Integration,
  type IntegrationContext,
  type ProviderDescriptor,
  type RemoteRecord,
} from "@/lib/integrations/types";

const API = "https://api.trello.com/1";

export const trelloDescriptor: ProviderDescriptor = {
  key: "trello",
  name: "Trello",
  category: "Project management",
  blurb: "Keep your Trello member name and bio consistent with your other accounts.",
  authMethod: "token",
  status: "available",
  // Trello signs every request with the app key plus a per-user token, so the
  // key must be present server-side even though the token is user-supplied.
  requiredEnv: ["TRELLO_API_KEY"],
  setupUrl: "https://trello.com/power-ups/admin",
  setupHint:
    "Create a Power-Up to obtain an API key, set TRELLO_API_KEY, then paste the user token Trello issues when you authorise it.",
  docsUrl: "https://developer.atlassian.com/cloud/trello/rest/api-group-members/",
  accent: "#0052cc",
  mark: "T",
  capabilities: {
    recordTypes: ["profile"],
    fields: {
      profile: fields(
        ["displayName", "email", "bio", "avatarUrl", "website"],
        ["displayName", "bio"],
      ),
    },
    supportsWebhooks: false,
    supportsDelete: false,
    rateLimitPerMinute: 100,
  },
};

interface TrelloMember {
  id: string;
  fullName?: string;
  username?: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  url?: string;
}

function apiKey(): string {
  const key = process.env.TRELLO_API_KEY;
  if (!key) {
    throw new IntegrationError({
      code: "not_configured",
      userMessage:
        "Trello has not been configured yet. An administrator needs to add TRELLO_API_KEY.",
      retryable: false,
    });
  }
  return key;
}

/** Trello authenticates by query parameter, not by bearer header. */
function url(path: string, token: string, params: Record<string, string> = {}) {
  const u = new URL(`${API}${path}`);
  u.searchParams.set("key", apiKey());
  u.searchParams.set("token", token);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

function toRecord(m: TrelloMember): RemoteRecord {
  return {
    externalId: m.id,
    recordType: "profile",
    fields: {
      displayName: m.fullName ?? null,
      email: m.email ?? null,
      bio: m.bio ?? null,
      avatarUrl: m.avatarUrl ? `${m.avatarUrl}/170.png` : null,
      website: m.url ?? null,
    },
    updatedAt: null,
  };
}

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  const member = await apiFetch<TrelloMember>(url("/members/me", ctx.accessToken), {
    providerName: "Trello",
  });
  return [toRecord(member)];
}

async function writeProfile(
  ctx: IntegrationContext,
  _externalId: string,
  patch: Record<string, string | null>,
): Promise<RemoteRecord> {
  const params: Record<string, string> = {};
  if ("displayName" in patch) params.fullName = patch.displayName ?? "";
  if ("bio" in patch) params.bio = patch.bio ?? "";

  const member = await apiFetch<TrelloMember>(
    url("/members/me", ctx.accessToken, params),
    { method: "PUT", providerName: "Trello" },
  );
  return toRecord(member);
}

export const trelloIntegration: Integration = defineTokenProvider({
  descriptor: trelloDescriptor,
  handlers: {
    readers: { profile: readProfile },
    writers: { profile: writeProfile },
  },
  async verify(token) {
    const member = await apiFetch<TrelloMember>(url("/members/me", token), {
      providerName: "Trello",
    });
    return {
      externalId: member.id,
      accountLabel: member.username ? `@${member.username}` : (member.fullName ?? "Trello account"),
    };
  },
});
