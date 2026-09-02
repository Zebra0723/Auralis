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

const API = "https://api.github.com";

/**
 * GitHub is the reference integration: it needs no OAuth app registration, so a
 * personal access token is enough to exercise the entire pipeline end to end
 * against a live third-party API.
 */
export const githubDescriptor: ProviderDescriptor = {
  key: "github",
  name: "GitHub",
  category: "Developer",
  blurb: "Keep your public profile — name, bio, company, location and website — in step with everywhere else.",
  authMethod: "token",
  status: "available",
  requiredEnv: [],
  setupUrl: "https://github.com/settings/tokens?type=beta",
  setupHint:
    "Create a fine-grained personal access token with Account permissions → Profile set to Read and write.",
  docsUrl: "https://docs.github.com/rest/users/users",
  accent: "#1f2328",
  mark: "G",
  capabilities: {
    recordTypes: ["profile"],
    fields: {
      profile: fields(
        ["displayName", "email", "company", "location", "bio", "website", "avatarUrl"],
        // The REST user endpoint accepts these; avatar and email are read-only here.
        ["displayName", "company", "location", "bio", "website"],
      ),
    },
    supportsWebhooks: false,
    supportsDelete: false,
    rateLimitPerMinute: 80,
  },
};

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  blog: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

function toRecord(user: GitHubUser): RemoteRecord {
  return {
    externalId: String(user.id),
    recordType: "profile",
    fields: {
      displayName: user.name,
      email: user.email,
      company: user.company,
      location: user.location,
      bio: user.bio,
      website: user.blog || null,
      avatarUrl: user.avatar_url,
    },
    updatedAt: user.updated_at ? new Date(user.updated_at) : null,
  };
}

/** Canonical key -> GitHub REST field name. */
const WRITE_MAP: Record<string, string> = {
  displayName: "name",
  company: "company",
  location: "location",
  bio: "bio",
  website: "blog",
};

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  const user = await apiFetch<GitHubUser>(`${API}/user`, {
    accessToken: ctx.accessToken,
    providerName: "GitHub",
    headers: { "X-GitHub-Api-Version": "2022-11-28" },
  });
  return [toRecord(user)];
}

async function writeProfile(
  ctx: IntegrationContext,
  _externalId: string,
  patch: Record<string, string | null>,
): Promise<RemoteRecord> {
  const body: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(patch)) {
    const remote = WRITE_MAP[key];
    if (remote) body[remote] = value;
  }

  if (Object.keys(body).length === 0) {
    throw new IntegrationError({
      code: "unsupported",
      userMessage: "None of those fields can be written to GitHub.",
      retryable: false,
    });
  }

  const user = await apiFetch<GitHubUser>(`${API}/user`, {
    method: "PATCH",
    accessToken: ctx.accessToken,
    providerName: "GitHub",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  });
  return toRecord(user);
}

export const githubIntegration: Integration = defineTokenProvider({
  descriptor: githubDescriptor,
  handlers: {
    readers: { profile: readProfile },
    writers: { profile: writeProfile },
  },
  async verify(token) {
    const user = await apiFetch<GitHubUser>(`${API}/user`, {
      accessToken: token,
      providerName: "GitHub",
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    });
    return {
      externalId: String(user.id),
      accountLabel: user.login ? `@${user.login}` : (user.name ?? "GitHub account"),
    };
  },
});
