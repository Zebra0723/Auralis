import { defineOAuthProvider } from "@/lib/integrations/base";
import { apiFetch, type OAuth2Config } from "@/lib/integrations/oauth2";
import { fields } from "@/lib/integrations/fields";
import type {
  Integration,
  IntegrationContext,
  ProviderDescriptor,
  RemoteRecord,
} from "@/lib/integrations/types";

const API = "https://app.asana.com/api/1.0";

export const asanaOAuth: OAuth2Config = {
  authorizeUrl: "https://app.asana.com/-/oauth_authorize",
  tokenUrl: "https://app.asana.com/-/oauth_token",
  clientIdEnv: "ASANA_CLIENT_ID",
  clientSecretEnv: "ASANA_CLIENT_SECRET",
  scopes: ["default"],
  usePkce: true,
};

export const asanaDescriptor: ProviderDescriptor = {
  key: "asana",
  name: "Asana",
  category: "Project management",
  blurb: "Read your Asana identity so your workspace profile can stay aligned.",
  authMethod: "oauth2",
  status: "available",
  requiredEnv: ["ASANA_CLIENT_ID", "ASANA_CLIENT_SECRET"],
  setupUrl: "https://app.asana.com/0/my-apps",
  setupHint:
    "Create an app in the Asana developer console and register the Auralis callback as a redirect URL.",
  docsUrl: "https://developers.asana.com/reference/users",
  accent: "#f06a6a",
  mark: "A",
  capabilities: {
    recordTypes: ["profile"],
    // Asana's API exposes the current user read-only; there is no profile write.
    fields: { profile: fields(["displayName", "email", "avatarUrl"], []) },
    supportsWebhooks: true,
    supportsDelete: false,
    rateLimitPerMinute: 150,
  },
};

interface AsanaUser {
  gid: string;
  name?: string;
  email?: string;
  photo?: { image_128x128?: string } | null;
}

function toRecord(u: AsanaUser): RemoteRecord {
  return {
    externalId: u.gid,
    recordType: "profile",
    fields: {
      displayName: u.name ?? null,
      email: u.email ?? null,
      avatarUrl: u.photo?.image_128x128 ?? null,
    },
    updatedAt: null,
  };
}

async function me(accessToken: string): Promise<AsanaUser> {
  // Asana wraps every response in a `data` envelope.
  const res = await apiFetch<{ data: AsanaUser }>(`${API}/users/me`, {
    accessToken,
    providerName: "Asana",
  });
  return res.data;
}

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  return [toRecord(await me(ctx.accessToken))];
}

export const asanaIntegration: Integration = defineOAuthProvider({
  descriptor: asanaDescriptor,
  oauth: asanaOAuth,
  handlers: {
    readers: { profile: readProfile },
    async identify(token) {
      const user = await me(token.accessToken);
      return { externalId: user.gid, accountLabel: user.email ?? user.name ?? "Asana account" };
    },
  },
});
