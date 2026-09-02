import { defineOAuthProvider } from "@/lib/integrations/base";
import { apiFetch, type OAuth2Config } from "@/lib/integrations/oauth2";
import { fields } from "@/lib/integrations/fields";
import type {
  Integration,
  IntegrationContext,
  ProviderDescriptor,
  RemoteRecord,
} from "@/lib/integrations/types";

const GRAPH = "https://graph.microsoft.com/v1.0";

export const microsoftOAuth: OAuth2Config = {
  authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  clientIdEnv: "MICROSOFT_CLIENT_ID",
  clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
  // offline_access is what makes the refresh token appear; without it syncs die
  // after roughly an hour.
  scopes: ["offline_access", "openid", "profile", "email", "User.Read", "User.ReadWrite"],
  usePkce: true,
};

export const microsoftDescriptor: ProviderDescriptor = {
  key: "microsoft",
  name: "Microsoft",
  category: "Productivity",
  blurb: "Sync your Microsoft 365 profile through Microsoft Graph.",
  authMethod: "oauth2",
  status: "available",
  requiredEnv: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
  setupUrl: "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps",
  setupHint:
    "Register an application in Microsoft Entra ID, add a Web redirect URI pointing at the Auralis callback, and grant delegated User.ReadWrite.",
  docsUrl: "https://learn.microsoft.com/graph/api/user-update",
  accent: "#0067b8",
  mark: "M",
  capabilities: {
    recordTypes: ["profile", "contact"],
    fields: {
      profile: fields(
        ["displayName", "firstName", "lastName", "email", "phone", "jobTitle", "company", "department", "location", "timezone"],
        ["displayName", "firstName", "lastName", "phone", "jobTitle", "company", "department", "location"],
      ),
      contact: fields(
        ["displayName", "firstName", "lastName", "email", "phone", "jobTitle", "company"],
        ["displayName", "firstName", "lastName", "email", "phone", "jobTitle", "company"],
      ),
    },
    supportsWebhooks: true,
    supportsDelete: true,
    rateLimitPerMinute: 120,
  },
};

interface GraphUser {
  id: string;
  displayName: string | null;
  givenName: string | null;
  surname: string | null;
  mail: string | null;
  userPrincipalName: string | null;
  mobilePhone: string | null;
  jobTitle: string | null;
  companyName: string | null;
  department: string | null;
  officeLocation: string | null;
}

function toRecord(user: GraphUser): RemoteRecord {
  return {
    externalId: user.id,
    recordType: "profile",
    fields: {
      displayName: user.displayName,
      firstName: user.givenName,
      lastName: user.surname,
      email: user.mail ?? user.userPrincipalName,
      phone: user.mobilePhone,
      jobTitle: user.jobTitle,
      company: user.companyName,
      department: user.department,
      location: user.officeLocation,
    },
    updatedAt: null,
  };
}

const WRITE_MAP: Record<string, string> = {
  displayName: "displayName",
  firstName: "givenName",
  lastName: "surname",
  phone: "mobilePhone",
  jobTitle: "jobTitle",
  company: "companyName",
  department: "department",
  location: "officeLocation",
};

const SELECT =
  "id,displayName,givenName,surname,mail,userPrincipalName,mobilePhone,jobTitle,companyName,department,officeLocation";

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  const user = await apiFetch<GraphUser>(`${GRAPH}/me?$select=${SELECT}`, {
    accessToken: ctx.accessToken,
    providerName: "Microsoft",
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

  await apiFetch<void>(`${GRAPH}/me`, {
    method: "PATCH",
    accessToken: ctx.accessToken,
    providerName: "Microsoft",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Graph answers 204 to a PATCH, so re-read to return the authoritative record.
  return (await readProfile(ctx))[0];
}

export const microsoftIntegration: Integration = defineOAuthProvider({
  descriptor: microsoftDescriptor,
  oauth: microsoftOAuth,
  handlers: {
    readers: { profile: readProfile },
    writers: { profile: writeProfile },
    async identify(token) {
      const user = await apiFetch<GraphUser>(`${GRAPH}/me?$select=id,displayName,mail,userPrincipalName`, {
        accessToken: token.accessToken,
        providerName: "Microsoft",
      });
      return {
        externalId: user.id,
        accountLabel: user.mail ?? user.userPrincipalName ?? user.displayName ?? "Microsoft account",
      };
    },
    async subscribe(ctx, callbackUrl) {
      const sub = await apiFetch<{ id: string; expirationDateTime: string }>(
        `${GRAPH}/subscriptions`,
        {
          method: "POST",
          accessToken: ctx.accessToken,
          providerName: "Microsoft",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            changeType: "updated",
            notificationUrl: callbackUrl,
            resource: "me",
            // Graph caps user subscriptions at roughly three days; the queue
            // renews before expiry.
            expirationDateTime: new Date(Date.now() + 60 * 60 * 24 * 1000).toISOString(),
            clientState: ctx.connectionId,
          }),
        },
      );
      return {
        supported: true,
        subscriptionId: sub.id,
        expiresAt: new Date(sub.expirationDateTime),
      };
    },
  },
});
