import { defineOAuthProvider } from "@/lib/integrations/base";
import { apiFetch, type OAuth2Config } from "@/lib/integrations/oauth2";
import { fields } from "@/lib/integrations/fields";
import type {
  Integration,
  IntegrationContext,
  ProviderDescriptor,
  RemoteRecord,
} from "@/lib/integrations/types";

/**
 * Drive is a separate connection from Google even though both use the same OAuth
 * client, because the consent a user grants for contact syncing should not
 * silently include their files. Different scopes, different connection.
 */
export const driveOAuth: OAuth2Config = {
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  scopes: [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
  ],
  usePkce: true,
  extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
};

export const driveDescriptor: ProviderDescriptor = {
  key: "googledrive",
  name: "Google Drive",
  category: "Storage",
  blurb: "Read the account details attached to your Drive so they can feed other services.",
  authMethod: "oauth2",
  status: "available",
  requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  setupUrl: "https://console.cloud.google.com/apis/credentials",
  setupHint:
    "Uses the same Google OAuth client as the Google connection. Enable the Drive API on the project.",
  docsUrl: "https://developers.google.com/drive/api/reference/rest/v3/about/get",
  accent: "#1e8e3e",
  mark: "D",
  capabilities: {
    recordTypes: ["profile"],
    fields: { profile: fields(["displayName", "email", "avatarUrl"], []) },
    supportsWebhooks: true,
    supportsDelete: false,
    rateLimitPerMinute: 100,
  },
};

interface DriveAbout {
  user?: {
    permissionId?: string;
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  };
}

async function about(accessToken: string): Promise<DriveAbout> {
  return apiFetch<DriveAbout>(
    "https://www.googleapis.com/drive/v3/about?fields=user(permissionId,displayName,emailAddress,photoLink)",
    { accessToken, providerName: "Google Drive" },
  );
}

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  const data = await about(ctx.accessToken);
  const u = data.user ?? {};
  return [
    {
      externalId: u.permissionId ?? "me",
      recordType: "profile",
      fields: {
        displayName: u.displayName ?? null,
        email: u.emailAddress ?? null,
        avatarUrl: u.photoLink ?? null,
      },
      updatedAt: null,
    },
  ];
}

export const driveIntegration: Integration = defineOAuthProvider({
  descriptor: driveDescriptor,
  oauth: driveOAuth,
  handlers: {
    readers: { profile: readProfile },
    async identify(token) {
      const data = await about(token.accessToken);
      return {
        externalId: data.user?.permissionId ?? "me",
        accountLabel: data.user?.emailAddress ?? "Google Drive account",
      };
    },
  },
});
