import { definePlannedProvider } from "@/lib/integrations/base";
import { fields } from "@/lib/integrations/fields";
import { asanaIntegration } from "@/lib/integrations/providers/asana";
import { discordIntegration } from "@/lib/integrations/providers/discord";
import { dropboxIntegration } from "@/lib/integrations/providers/dropbox";
import { githubIntegration } from "@/lib/integrations/providers/github";
import { googleIntegration } from "@/lib/integrations/providers/google";
import { driveIntegration } from "@/lib/integrations/providers/googledrive";
import { microsoftIntegration } from "@/lib/integrations/providers/microsoft";
import { slackIntegration } from "@/lib/integrations/providers/slack";
import { trelloIntegration } from "@/lib/integrations/providers/trello";
import { vaultIntegration } from "@/lib/integrations/providers/vault";
import { zoomIntegration } from "@/lib/integrations/providers/zoom";
import type {
  Integration,
  ProviderDescriptor,
  RecordType,
} from "@/lib/integrations/types";

/**
 * Providers with no adapter yet. They are listed so the marketplace is honest
 * about the roadmap, and every operation on them refuses rather than pretending.
 */
const notionDescriptor: ProviderDescriptor = {
  key: "notion",
  name: "Notion",
  category: "Productivity",
  blurb: "Sync people properties across Notion databases.",
  authMethod: "oauth2",
  status: "planned",
  requiredEnv: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"],
  accent: "#191919",
  mark: "N",
  capabilities: {
    recordTypes: ["profile"],
    fields: { profile: fields(["displayName", "email", "avatarUrl"], []) },
    supportsWebhooks: false,
    supportsDelete: false,
  },
};

const linkedinDescriptor: ProviderDescriptor = {
  key: "linkedin",
  name: "LinkedIn",
  category: "Social",
  blurb: "Keep your headline and current role consistent with your other profiles.",
  authMethod: "oauth2",
  status: "planned",
  requiredEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  accent: "#0a66c2",
  mark: "L",
  capabilities: {
    recordTypes: ["profile"],
    fields: { profile: fields(["displayName", "firstName", "lastName", "jobTitle", "company"], []) },
    supportsWebhooks: false,
    supportsDelete: false,
  },
};

const hubspotDescriptor: ProviderDescriptor = {
  key: "hubspot",
  name: "HubSpot",
  category: "CRM",
  blurb: "Keep contact records in step with the rest of your stack.",
  authMethod: "oauth2",
  status: "planned",
  requiredEnv: ["HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET"],
  accent: "#ff7a59",
  mark: "H",
  capabilities: {
    recordTypes: ["contact"],
    fields: { contact: fields(["displayName", "email", "phone", "company", "jobTitle"], []) },
    supportsWebhooks: true,
    supportsDelete: true,
  },
};

/**
 * The single source of truth for which services exist. The UI, the sync planner
 * and the OAuth callback all read from here, so registering an integration in
 * this list is the only wiring step required to ship it.
 */
const INTEGRATIONS: Integration[] = [
  vaultIntegration,
  googleIntegration,
  microsoftIntegration,
  slackIntegration,
  githubIntegration,
  dropboxIntegration,
  driveIntegration,
  zoomIntegration,
  trelloIntegration,
  asanaIntegration,
  discordIntegration,
  definePlannedProvider(notionDescriptor),
  definePlannedProvider(linkedinDescriptor),
  definePlannedProvider(hubspotDescriptor),
];

const BY_KEY = new Map(INTEGRATIONS.map((i) => [i.descriptor.key, i]));

export function getIntegration(key: string): Integration {
  const integration = BY_KEY.get(key);
  if (!integration) throw new Error(`Unknown provider: ${key}`);
  return integration;
}

export function tryGetIntegration(key: string): Integration | null {
  return BY_KEY.get(key) ?? null;
}

export function allIntegrations(): Integration[] {
  return INTEGRATIONS;
}

export function allDescriptors(): ProviderDescriptor[] {
  return INTEGRATIONS.map((i) => i.descriptor);
}

/** True when every env var the provider needs is present on this deployment. */
export function isConfigured(descriptor: ProviderDescriptor): boolean {
  return descriptor.requiredEnv.every((key) => Boolean(process.env[key]));
}

export type ConnectableState =
  | { connectable: true }
  | { connectable: false; reason: "planned" | "not_configured"; missingEnv: string[] };

export function connectableState(descriptor: ProviderDescriptor): ConnectableState {
  if (descriptor.status === "planned") {
    return { connectable: false, reason: "planned", missingEnv: [] };
  }
  const missingEnv = descriptor.requiredEnv.filter((key) => !process.env[key]);
  if (missingEnv.length) {
    return { connectable: false, reason: "not_configured", missingEnv };
  }
  return { connectable: true };
}

/**
 * Which fields a provider can accept for a record type. This is what lets the
 * sync builder offer only destinations that can actually receive a given field,
 * rather than letting a user configure a sync that can never succeed.
 */
export function writableFields(providerKey: string, recordType: RecordType): string[] {
  const descriptor = tryGetIntegration(providerKey)?.descriptor;
  return (descriptor?.capabilities.fields[recordType] ?? [])
    .filter((f) => f.writable)
    .map((f) => f.key);
}

export function readableFields(providerKey: string, recordType: RecordType): string[] {
  const descriptor = tryGetIntegration(providerKey)?.descriptor;
  return (descriptor?.capabilities.fields[recordType] ?? []).map((f) => f.key);
}

/** Fields a pair of providers can actually exchange for a record type. */
export function overlappingFields(
  sourceKey: string,
  targetKey: string,
  recordType: RecordType,
): string[] {
  const readable = new Set(readableFields(sourceKey, recordType));
  return writableFields(targetKey, recordType).filter((f) => readable.has(f));
}
