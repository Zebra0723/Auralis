import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { fields } from "@/lib/integrations/fields";
import type {
  Integration,
  IntegrationContext,
  ProviderDescriptor,
  RemoteRecord,
} from "@/lib/integrations/types";

const ALL = [
  "displayName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "jobTitle",
  "company",
  "department",
  "location",
  "bio",
  "website",
  "avatarUrl",
  "timezone",
  "pronouns",
];

export const vaultDescriptor: ProviderDescriptor = {
  key: "vault",
  name: "Auralis Vault",
  category: "Auralis",
  blurb:
    "Your canonical record. Change something here and Auralis pushes it out to every service that supports the field.",
  authMethod: "internal",
  status: "available",
  requiredEnv: [],
  accent: "#0d7a63",
  mark: "A",
  capabilities: {
    recordTypes: ["profile"],
    fields: { profile: fields(ALL, ALL) },
    supportsWebhooks: true,
    supportsDelete: true,
  },
};

/**
 * The hub, exposed through the same interface as any third-party service.
 *
 * Treating the canonical store as just another provider means the sync engine
 * has exactly one code path: it never needs to know whether an endpoint is
 * local or remote.
 */
async function readProfile(ctx: IntegrationContext): Promise<RemoteRecord[]> {
  const record = await db.canonicalRecord.findFirst({
    where: { orgId: ctx.orgId, recordType: "profile" },
    orderBy: { createdAt: "asc" },
  });
  if (!record) return [];
  return [
    {
      externalId: record.id,
      recordType: "profile",
      fields: (record.fields ?? {}) as Record<string, string | null>,
      updatedAt: record.updatedAt,
    },
  ];
}

async function writeProfile(
  ctx: IntegrationContext,
  externalId: string,
  patch: Record<string, string | null>,
): Promise<RemoteRecord> {
  const existing = await db.canonicalRecord.findFirst({
    where: { orgId: ctx.orgId, recordType: "profile" },
    orderBy: { createdAt: "asc" },
  });

  const merged = {
    ...((existing?.fields ?? {}) as Record<string, unknown>),
    ...patch,
  } as Prisma.InputJsonObject;

  const record = existing
    ? await db.canonicalRecord.update({
        where: { id: existing.id },
        data: { fields: merged, version: { increment: 1 } },
      })
    : await db.canonicalRecord.create({
        data: { orgId: ctx.orgId, recordType: "profile", fields: merged },
      });

  return {
    externalId: record.id,
    recordType: "profile",
    fields: merged as Record<string, string | null>,
    updatedAt: record.updatedAt,
  };
}

export const vaultIntegration: Integration = {
  descriptor: vaultDescriptor,

  async authenticate() {
    // The Vault belongs to the workspace already; there is nothing to authorise.
    return { needsToken: true as const };
  },

  async completeAuthentication() {
    return {
      accessToken: "internal",
      refreshToken: null,
      tokenType: "internal",
      expiresAt: null,
      externalId: "vault",
      accountLabel: "This workspace",
    };
  },

  async refreshToken() {
    return {
      accessToken: "internal",
      refreshToken: null,
      tokenType: "internal",
      expiresAt: null,
    };
  },

  async getData(ctx, recordType) {
    if (recordType !== "profile") return [];
    return readProfile(ctx);
  },

  async updateData(ctx, _recordType, externalId, patch) {
    return writeProfile(ctx, externalId, patch);
  },

  async deleteData(ctx, _recordType, externalId) {
    await db.canonicalRecord.deleteMany({ where: { id: externalId, orgId: ctx.orgId } });
  },

  async subscribeToChanges() {
    // Local writes enqueue jobs directly, so there is nothing to subscribe to.
    return { supported: true, subscriptionId: "internal" };
  },

  async disconnect() {},
};
