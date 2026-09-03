import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, parseBody, requireUser, writeAudit } from "@/lib/api";
import { getIntegration } from "@/lib/integrations/registry";
import { getConnectionContext } from "@/lib/sync/connection-context";
import { valueHash } from "@/lib/crypto";
import { fieldLabel } from "@/lib/integrations/fields";
import type { RecordType } from "@/lib/integrations/types";

const resolveSchema = z.object({
  resolution: z.enum([
    "keep_source",
    "keep_target",
    "merge",
    "always_source",
    "always_target",
  ]),
  /** Required for "merge": the value the user assembled from both sides. */
  mergedValue: z.string().max(2000).optional(),
});

/**
 * POST /api/conflicts/:id — resolve one conflict.
 *
 * Resolution writes the chosen value to whichever side lost, then records new
 * checkpoints on both sides. Without that second step the next run would see
 * two values that still differ from their stored history and immediately raise
 * the same conflict again.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await parseBody(request, resolveSchema);
  if (!body.ok) return body.response;

  const conflict = await db.conflict.findFirst({
    where: { id, orgId: auth.user.orgId },
    include: {
      syncConfig: { include: { source: true, target: true } },
    },
  });
  if (!conflict) return fail("That conflict could not be found.", 404, "not_found");
  if (conflict.status !== "OPEN") {
    return fail("That conflict has already been resolved.", 409, "already_resolved");
  }

  const { resolution, mergedValue } = body.data;
  if (resolution === "merge" && mergedValue === undefined) {
    return fail("Provide the merged value to save.", 422, "missing_value");
  }

  const winningValue =
    resolution === "merge"
      ? (mergedValue ?? null)
      : resolution === "keep_source" || resolution === "always_source"
        ? conflict.sourceValue
        : conflict.targetValue;

  const winningHash = await valueHash(winningValue);
  const sync = conflict.syncConfig;
  const recordType = sync.recordType as RecordType;

  try {
    // Write the winning value to every side that does not already hold it.
    const sides = [
      { connection: sync.source, current: conflict.sourceValue },
      { connection: sync.target, current: conflict.targetValue },
    ];

    for (const side of sides) {
      if ((await valueHash(side.current)) === winningHash) continue;

      const integration = getIntegration(side.connection.provider);
      const writable = integration.descriptor.capabilities.fields[recordType]?.find(
        (f) => f.key === conflict.field && f.writable,
      );
      if (!writable) continue;

      const ctx = await getConnectionContext(side.connection);
      const records = await integration.getData(ctx, recordType);
      const record = records[0];
      if (!record) continue;

      await integration.updateData(ctx, recordType, record.externalId, {
        [conflict.field]: winningValue,
      });
    }

    // Both sides now agree, so both checkpoints must record that agreement.
    for (const side of sides) {
      await db.fieldCheckpoint.upsert({
        where: {
          recordId_connectionId_field: {
            recordId: conflict.recordId,
            connectionId: side.connection.id,
            field: conflict.field,
          },
        },
        create: {
          recordId: conflict.recordId,
          connectionId: side.connection.id,
          field: conflict.field,
          valueHash: winningHash,
          value: winningValue,
        },
        update: {
          valueHash: winningHash,
          value: winningValue,
          observedAt: new Date(),
        },
      });
    }

    const canonical = await db.canonicalRecord.findUnique({
      where: { id: conflict.recordId },
    });
    if (canonical) {
      await db.canonicalRecord.update({
        where: { id: canonical.id },
        data: {
          fields: {
            ...((canonical.fields ?? {}) as Record<string, unknown>),
            [conflict.field]: winningValue,
          } as never,
          version: { increment: 1 },
        },
      });
    }

    // "Always prefer" turns a one-off decision into standing policy.
    if (resolution === "always_source" || resolution === "always_target") {
      await db.syncConfig.update({
        where: { id: sync.id },
        data: {
          conflictPolicy: resolution === "always_source" ? "PREFER_SOURCE" : "PREFER_TARGET",
        },
      });
    }

    await db.conflict.update({
      where: { id: conflict.id },
      data: { status: "RESOLVED", resolution, resolvedAt: new Date() },
    });

    await db.syncEvent.create({
      data: {
        orgId: auth.user.orgId,
        syncConfigId: sync.id,
        level: "SUCCESS",
        title: "Conflict resolved",
        detail: `${fieldLabel(conflict.field)} is now consistent across ${sync.source.displayName} and ${sync.target.displayName}.`,
        field: conflict.field,
        sourceLabel: sync.source.displayName,
        targetLabel: sync.target.displayName,
      },
    });

    await writeAudit({
      orgId: auth.user.orgId,
      userId: auth.user.id,
      action: "conflict.resolved",
      target: conflict.id,
      metadata: { field: conflict.field, resolution },
    });

    return ok({ resolved: true });
  } catch (error) {
    return handleError(error, `resolve conflict ${id}`);
  }
}
