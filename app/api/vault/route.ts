import { z } from "zod";
import { db } from "@/lib/db";
import { handleError, ok, parseBody, requireUser, writeAudit } from "@/lib/api";
import { CANONICAL_PROFILE_FIELDS } from "@/lib/integrations/fields";
import { enqueue } from "@/lib/queue";
import type { Prisma } from "@prisma/client";

/**
 * The Vault is where a user changes something once.
 *
 * A write here updates the canonical record and then queues every sync whose
 * source is the Vault, which is the mechanism behind "change it in Auralis and
 * it reaches everywhere that supports the field".
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const record = await db.canonicalRecord.findFirst({
    where: { orgId: auth.user.orgId, recordType: "profile" },
    orderBy: { createdAt: "asc" },
  });

  return ok({
    fields: (record?.fields ?? {}) as Record<string, string | null>,
    version: record?.version ?? 0,
    updatedAt: record?.updatedAt ?? null,
  });
}

const knownFields = Object.keys(CANONICAL_PROFILE_FIELDS);

const patchSchema = z.object({
  fields: z
    .record(z.string(), z.string().max(2000).nullable())
    .refine(
      (value) => Object.keys(value).every((key) => knownFields.includes(key)),
      { message: "One of those fields is not a recognised profile field." },
    ),
});

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, patchSchema);
  if (!body.ok) return body.response;

  try {
    const existing = await db.canonicalRecord.findFirst({
      where: { orgId: auth.user.orgId, recordType: "profile" },
      orderBy: { createdAt: "asc" },
    });

    // Empty strings mean "clear this", which is different from "leave it alone".
    const cleaned = Object.fromEntries(
      Object.entries(body.data.fields).map(([key, value]) => [
        key,
        value === null || value.trim() === "" ? null : value.trim(),
      ]),
    );

    const merged = {
      ...((existing?.fields ?? {}) as Record<string, unknown>),
      ...cleaned,
    } as Prisma.InputJsonObject;

    const record = existing
      ? await db.canonicalRecord.update({
          where: { id: existing.id },
          data: { fields: merged, version: { increment: 1 } },
        })
      : await db.canonicalRecord.create({
          data: { orgId: auth.user.orgId, recordType: "profile", fields: merged },
        });

    // Push the change outward through any sync that reads from the Vault.
    const vaultConnections = await db.connection.findMany({
      where: { orgId: auth.user.orgId, provider: "vault" },
      select: { id: true },
    });

    if (vaultConnections.length) {
      const syncs = await db.syncConfig.findMany({
        where: {
          orgId: auth.user.orgId,
          enabled: true,
          sourceConnectionId: { in: vaultConnections.map((c) => c.id) },
        },
        select: { id: true },
      });
      for (const sync of syncs) {
        await enqueue({ orgId: auth.user.orgId, syncConfigId: sync.id });
      }
    }

    const changed = Object.keys(cleaned);
    await db.syncEvent.create({
      data: {
        orgId: auth.user.orgId,
        level: "INFO",
        title: changed.length === 1 ? `${CANONICAL_PROFILE_FIELDS[changed[0]]?.label ?? changed[0]} changed` : "Profile updated",
        detail: "Queued for every service that accepts these fields.",
      },
    });

    await writeAudit({
      orgId: auth.user.orgId,
      userId: auth.user.id,
      action: "vault.updated",
      target: record.id,
      metadata: { fields: changed },
    });

    return ok({ fields: merged, version: record.version });
  } catch (error) {
    return handleError(error, "update vault");
  }
}
