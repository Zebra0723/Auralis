import { defineOAuthProvider } from "@/lib/integrations/base";
import { apiFetch, type OAuth2Config } from "@/lib/integrations/oauth2";
import { fields } from "@/lib/integrations/fields";
import type {
  Integration,
  IntegrationContext,
  ProviderDescriptor,
  RemoteRecord,
} from "@/lib/integrations/types";

const PEOPLE = "https://people.googleapis.com/v1";

const PERSON_FIELDS = [
  "names",
  "emailAddresses",
  "phoneNumbers",
  "organizations",
  "biographies",
  "urls",
  "photos",
  "locations",
].join(",");

export const googleOAuth: OAuth2Config = {
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  revokeUrl: "https://oauth2.googleapis.com/revoke",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  scopes: [
    "openid",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/contacts",
  ],
  usePkce: true,
  // Without these Google withholds the refresh token on repeat authorisations,
  // which silently breaks long-lived syncs.
  extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
};

export const googleDescriptor: ProviderDescriptor = {
  key: "google",
  name: "Google",
  category: "Productivity",
  blurb: "Sync your Google profile and contact details through the People API.",
  authMethod: "oauth2",
  status: "available",
  requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  setupUrl: "https://console.cloud.google.com/apis/credentials",
  setupHint:
    "Create an OAuth 2.0 Client ID (Web application), enable the People API, and add the Auralis callback URL as an authorised redirect URI.",
  docsUrl: "https://developers.google.com/people/api/rest/v1/people/updateContact",
  accent: "#1a73e8",
  mark: "G",
  capabilities: {
    recordTypes: ["profile", "contact"],
    fields: {
      profile: fields(
        ["displayName", "firstName", "lastName", "email", "phone", "jobTitle", "company", "bio", "website", "avatarUrl", "location"],
        ["displayName", "firstName", "lastName", "phone", "jobTitle", "company", "bio", "website"],
      ),
      contact: fields(
        ["displayName", "firstName", "lastName", "email", "phone", "jobTitle", "company"],
        ["displayName", "firstName", "lastName", "email", "phone", "jobTitle", "company"],
      ),
    },
    supportsWebhooks: false,
    supportsDelete: true,
    rateLimitPerMinute: 90,
  },
};

interface Person {
  resourceName: string;
  etag?: string;
  names?: { displayName?: string; givenName?: string; familyName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string }[];
  organizations?: { name?: string; title?: string }[];
  biographies?: { value?: string }[];
  urls?: { value?: string }[];
  photos?: { url?: string }[];
  locations?: { value?: string }[];
}

function toRecord(person: Person): RemoteRecord {
  const name = person.names?.[0];
  const org = person.organizations?.[0];
  return {
    externalId: person.resourceName,
    recordType: "profile",
    fields: {
      displayName: name?.displayName ?? null,
      firstName: name?.givenName ?? null,
      lastName: name?.familyName ?? null,
      email: person.emailAddresses?.[0]?.value ?? null,
      phone: person.phoneNumbers?.[0]?.value ?? null,
      jobTitle: org?.title ?? null,
      company: org?.name ?? null,
      bio: person.biographies?.[0]?.value ?? null,
      website: person.urls?.[0]?.value ?? null,
      avatarUrl: person.photos?.[0]?.url ?? null,
      location: person.locations?.[0]?.value ?? null,
    },
    updatedAt: null,
  };
}

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  const person = await apiFetch<Person>(
    `${PEOPLE}/people/me?personFields=${PERSON_FIELDS}`,
    { accessToken: ctx.accessToken, providerName: "Google" },
  );
  return [toRecord(person)];
}

/**
 * People API writes are field-group replacements guarded by an etag, so a write
 * must re-read first. That read also gives us optimistic concurrency: if the
 * profile changed underneath us, Google rejects the etag and we retry rather
 * than clobbering the newer value.
 */
async function writeProfile(
  ctx: IntegrationContext,
  _externalId: string,
  patch: Record<string, string | null>,
): Promise<RemoteRecord> {
  const current = await apiFetch<Person>(
    `${PEOPLE}/people/me?personFields=${PERSON_FIELDS}`,
    { accessToken: ctx.accessToken, providerName: "Google" },
  );

  const body: Person = { resourceName: current.resourceName, etag: current.etag };
  const groups = new Set<string>();

  if ("displayName" in patch || "firstName" in patch || "lastName" in patch) {
    const existing = current.names?.[0] ?? {};
    body.names = [
      {
        givenName: patch.firstName ?? existing.givenName,
        familyName: patch.lastName ?? existing.familyName,
        displayName: patch.displayName ?? existing.displayName,
      },
    ];
    groups.add("names");
  }
  if ("phone" in patch) {
    body.phoneNumbers = [{ value: patch.phone ?? undefined }];
    groups.add("phoneNumbers");
  }
  if ("company" in patch || "jobTitle" in patch) {
    const existing = current.organizations?.[0] ?? {};
    body.organizations = [
      { name: patch.company ?? existing.name, title: patch.jobTitle ?? existing.title },
    ];
    groups.add("organizations");
  }
  if ("bio" in patch) {
    body.biographies = [{ value: patch.bio ?? undefined }];
    groups.add("biographies");
  }
  if ("website" in patch) {
    body.urls = [{ value: patch.website ?? undefined }];
    groups.add("urls");
  }

  const updated = await apiFetch<Person>(
    `${PEOPLE}/people/me:updateContact?updatePersonFields=${[...groups].join(",")}&personFields=${PERSON_FIELDS}`,
    {
      method: "PATCH",
      accessToken: ctx.accessToken,
      providerName: "Google",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return toRecord(updated);
}

export const googleIntegration: Integration = defineOAuthProvider({
  descriptor: googleDescriptor,
  oauth: googleOAuth,
  handlers: {
    readers: { profile: readProfile },
    writers: { profile: writeProfile },
    async identify(token) {
      const info = await apiFetch<{ sub: string; email?: string; name?: string }>(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { accessToken: token.accessToken, providerName: "Google" },
      );
      return { externalId: info.sub, accountLabel: info.email ?? info.name ?? "Google account" };
    },
    async revoke(ctx) {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(ctx.accessToken)}`,
        { method: "POST" },
      );
    },
  },
});
