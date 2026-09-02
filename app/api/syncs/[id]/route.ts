import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, parseBody, requireUser, writeAudit } from "@/lib/api";
import { enqueue, nextRunFor } from "@/lib/queue";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  fields: z.array(z.string()).min(1).optional(),
  direction: z.enum(["ONE_WAY", "TWO_WAY"]).optional(),
  frequency: z.enum(["REALTIME", "EVERY_15_MIN", "HOURLY", "DAILY", "MANUAL"]).optional(),
  conflictPolicy: z.enum(["ASK", "PREFER_SOURCE", "PREFER_TARGET", "NEWEST_WINS"]).optional(),
  propagateDeletes: z.boolean().optional(),
  /** Set to true to queue a run immediately. */
  runNow: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await parseBody(request, patchSchema);
  if (!body.ok) return body.response;

  const sync = await db.syncConfig.findFirst({ where: { id, orgId: auth.user.orgId } });
  if (!sync) return fail("That sync could not be found.", 404, "not_found");

  const { runNow, ...updates } = body.data;

  try {
    if (Object.keys(updates).length) {
      await db.syncConfig.update({
        where: { id },
        data: {
          ...updates,
          // A schedule change should take effect from now, not from the old cadence.
          ...(updates.frequency
            ? { nextRunAt: updates.frequency === "MANUAL" ? null : nextRunFor(updates.frequency) }
            : {}),
        },
      });

      await writeAudit({
        orgId: auth.user.orgId,
        userId: auth.user.id,
        action: "sync.updated",
        target: id,
        metadata: updates,
      });
    }

    if (runNow) {
      await enqueue({ orgId: auth.user.orgId, syncConfigId: id });
    }

    return ok({ updated: true, queued: Boolean(runNow) });
  } catch (error) {
    return handleError(error, `update sync ${id}`);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const sync = await db.syncConfig.findFirst({ where: { id, orgId: auth.user.orgId } });
  if (!sync) return fail("That sync could not be found.", 404, "not_found");

  try {
    await db.syncConfig.delete({ where: { id } });
    await writeAudit({
      orgId: auth.user.orgId,
      userId: auth.user.id,
      action: "sync.deleted",
      target: id,
      metadata: { name: sync.name },
    });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error, `delete sync ${id}`);
  }
}
