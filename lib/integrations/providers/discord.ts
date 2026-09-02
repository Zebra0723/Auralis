import { defineOAuthProvider } from "@/lib/integrations/base";
import { apiFetch, type OAuth2Config } from "@/lib/integrations/oauth2";
import { fields } from "@/lib/integrations/fields";
import type {
  Integration,
  IntegrationContext,
  ProviderDescriptor,
  RemoteRecord,
} from "@/lib/integrations/types";

const API = "https://discord.com/api/v10";

export const discordOAuth: OAuth2Config = {
  authorizeUrl: "https://discord.com/oauth2/authorize",
  tokenUrl: `${API}/oauth2/token`,
  revokeUrl: `${API}/oauth2/token/revoke`,
  clientIdEnv: "DISCORD_CLIENT_ID",
  clientSecretEnv: "DISCORD_CLIENT_SECRET",
  scopes: ["identify", "email"],
};

export const discordDescriptor: ProviderDescriptor = {
  key: "discord",
  name: "Discord",
  category: "Communication",
  blurb: "Read your Discord identity so it can inform your profile elsewhere.",
  authMethod: "oauth2",
  status: "available",
  requiredEnv: ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"],
  setupUrl: "https://discord.com/developers/applications",
  setupHint:
    "Create an application, then add the Auralis callback under OAuth2 → Redirects with the identify and email scopes.",
  docsUrl: "https://discord.com/developers/docs/resources/user",
  accent: "#5865f2",
  mark: "D",
  capabilities: {
    recordTypes: ["profile"],
    // Discord's user endpoint only accepts username and avatar changes, and
    // username edits are heavily rate limited, so Auralis treats it as read-only.
    fields: { profile: fields(["displayName", "email", "avatarUrl"], []) },
    supportsWebhooks: false,
    supportsDelete: false,
    rateLimitPerMinute: 50,
  },
};

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  email: string | null;
  avatar: string | null;
}

function toRecord(u: DiscordUser): RemoteRecord {
  return {
    externalId: u.id,
    recordType: "profile",
    fields: {
      displayName: u.global_name ?? u.username ?? null,
      email: u.email ?? null,
      avatarUrl: u.avatar
        ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256`
        : null,
    },
    updatedAt: null,
  };
}

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  const user = await apiFetch<DiscordUser>(`${API}/users/@me`, {
    accessToken: ctx.accessToken,
    providerName: "Discord",
  });
  return [toRecord(user)];
}

export const discordIntegration: Integration = defineOAuthProvider({
  descriptor: discordDescriptor,
  oauth: discordOAuth,
  handlers: {
    readers: { profile: readProfile },
    async identify(token) {
      const user = await apiFetch<DiscordUser>(`${API}/users/@me`, {
        accessToken: token.accessToken,
        providerName: "Discord",
      });
      return { externalId: user.id, accountLabel: `@${user.username}` };
    },
  },
});
