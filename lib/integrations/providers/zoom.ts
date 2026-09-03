import { defineOAuthProvider } from "@/lib/integrations/base";
import { apiFetch, type OAuth2Config } from "@/lib/integrations/oauth2";
import { fields } from "@/lib/integrations/fields";
import type {
  Integration,
  IntegrationContext,
  ProviderDescriptor,
  RemoteRecord,
} from "@/lib/integrations/types";

const API = "https://api.zoom.us/v2";

export const zoomOAuth: OAuth2Config = {
  authorizeUrl: "https://zoom.us/oauth/authorize",
  tokenUrl: "https://zoom.us/oauth/token",
  clientIdEnv: "ZOOM_CLIENT_ID",
  clientSecretEnv: "ZOOM_CLIENT_SECRET",
  scopes: ["user:read", "user:write"],
  // Zoom requires HTTP Basic on the token endpoint and rejects body credentials.
  tokenAuthStyle: "basic",
};

export const zoomDescriptor: ProviderDescriptor = {
  key: "zoom",
  name: "Zoom",
  category: "Communication",
  blurb: "Keep the name, job title and company on your Zoom profile consistent with everywhere else.",
  authMethod: "oauth2",
  status: "available",
  requiredEnv: ["ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET"],
  setupUrl: "https://marketplace.zoom.us/develop/create",
  setupHint:
    "Create a General App in the Zoom Marketplace, add the Auralis callback as an OAuth redirect URL, and add the user:read and user:write scopes.",
  docsUrl: "https://developers.zoom.us/docs/api/users/#tag/users/PATCH/users/{userId}",
  accent: "#0b5cff",
  mark: "Z",
  capabilities: {
    recordTypes: ["profile"],
    fields: {
      profile: fields(
        ["firstName", "lastName", "displayName", "email", "phone", "jobTitle", "company", "location", "timezone", "avatarUrl"],
        ["firstName", "lastName", "displayName", "phone", "jobTitle", "company", "location"],
      ),
    },
    supportsWebhooks: true,
    supportsDelete: false,
    rateLimitPerMinute: 60,
  },
};

interface ZoomUser {
  id: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  email?: string;
  phone_number?: string;
  job_title?: string;
  company?: string;
  location?: string;
  timezone?: string;
  pic_url?: string;
}

function toRecord(user: ZoomUser): RemoteRecord {
  return {
    externalId: user.id,
    recordType: "profile",
    fields: {
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      displayName: user.display_name ?? null,
      email: user.email ?? null,
      phone: user.phone_number ?? null,
      jobTitle: user.job_title ?? null,
      company: user.company ?? null,
      location: user.location ?? null,
      timezone: user.timezone ?? null,
      avatarUrl: user.pic_url ?? null,
    },
    updatedAt: null,
  };
}

const WRITE_MAP: Record<string, string> = {
  firstName: "first_name",
  lastName: "last_name",
  displayName: "display_name",
  phone: "phone_number",
  jobTitle: "job_title",
  company: "company",
  location: "location",
};

async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  const user = await apiFetch<ZoomUser>(`${API}/users/me`, {
    accessToken: ctx.accessToken,
    providerName: "Zoom",
  });
  return [toRecord(user)];
}

async function writeProfile(
  ctx: IntegrationContext,
  _externalId: string,
  patch: Record<string, string | null>,
): Promise<RemoteRecord> {
  const body: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch)) {
    const remote = WRITE_MAP[key];
    if (remote && value !== null) body[remote] = value;
  }
  await apiFetch<void>(`${API}/users/me`, {
    method: "PATCH",
    accessToken: ctx.accessToken,
    providerName: "Zoom",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await readProfile(ctx))[0];
}

export const zoomIntegration: Integration = defineOAuthProvider({
  descriptor: zoomDescriptor,
  oauth: zoomOAuth,
  handlers: {
    readers: { profile: readProfile },
    writers: { profile: writeProfile },
    async identify(token) {
      const user = await apiFetch<ZoomUser>(`${API}/users/me`, {
        accessToken: token.accessToken,
        providerName: "Zoom",
      });
      return { externalId: user.id, accountLabel: user.email ?? "Zoom account" };
    },
  },
});
