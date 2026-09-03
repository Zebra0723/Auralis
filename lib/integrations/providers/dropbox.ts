import { defineOAuthProvider } from "@/lib/integrations/base";
import { apiFetch, type OAuth2Config } from "@/lib/integrations/oauth2";
import { fields } from "@/lib/integrations/fields";
import type {
  Integration,
  IntegrationContext,
  ProviderDescriptor,
  RemoteRecord,
} from "@/lib/integrations/types";

export const dropboxOAuth: OAuth2Config = {
  authorizeUrl: "https://www.dropbox.com/oauth2/authorize",
  tokenUrl: "https://api.dropboxapi.com/oauth2/token",
  clientIdEnv: "DROPBOX_CLIENT_ID",
  clientSecretEnv: "DROPBOX_CLIENT_SECRET",
  scopes: ["account_info.read"],
  usePkce: true,
  // Dropbox only issues refresh tokens when the grant is explicitly offline.
  extraAuthorizeParams: { token_access_type: "offline" },
};

export const dropboxDescriptor: ProviderDescriptor = {
  key: "dropbox",
  name: "Dropbox",
  category: "Storage",
  blurb: "Read your Dropbox account details so they can feed the rest of your connected services.",
  authMethod: "oauth2",
  status: "available",
  requiredEnv: ["DROPBOX_CLIENT_ID", "DROPBOX_CLIENT_SECRET"],
  setupUrl: "https://www.dropbox.com/developers/apps",
  setupHint:
    "Create a Dropbox app with the account_info.read permission and add the Auralis callback as a redirect URI.",
  docsUrl: "https://www.dropbox.com/developers/documentation/http/documentation",
  accent: "#0061fe",
  mark: "D",
  capabilities: {
    recordTypes: ["profile"],
    // Dropbox exposes no profile write endpoint, so this is a source only.
    fields: { profile: fields(["displayName", "firstName", "lastName", "email", "avatarUrl"], []) },
    supportsWebhooks: false,
    supportsDelete: false,
    rateLimitPerMinute: 60,
  },
};

interface DropboxAccount {
  account_id: string;
  name?: { display_name?: string; given_name?: string; surname?: string };
  email?: string;
  profile_photo_url?: string;
}

function toRecord(a: DropboxAccount): RemoteRecord {
  return {
    externalId: a.account_id,
    recordType: "profile",
    fields: {
      displayName: a.name?.display_name ?? null,
      firstName: a.name?.given_name ?? null,
      lastName: a.name?.surname ?? null,
      email: a.email ?? null,
      avatarUrl: a.profile_photo_url ?? null,
    },
    updatedAt: null,
  };
}

async function currentAccount(accessToken: string): Promise<DropboxAccount> {
  // This endpoint is a POST with a null body, which is unusual but correct.
  return apiFetch<DropboxAccount>("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    accessToken,
    providerName: "Dropbox",
  });
}

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  return [toRecord(await currentAccount(ctx.accessToken))];
}

export const dropboxIntegration: Integration = defineOAuthProvider({
  descriptor: dropboxDescriptor,
  oauth: dropboxOAuth,
  handlers: {
    readers: { profile: readProfile },
    async identify(token) {
      const a = await currentAccount(token.accessToken);
      return { externalId: a.account_id, accountLabel: a.email ?? "Dropbox account" };
    },
  },
});
