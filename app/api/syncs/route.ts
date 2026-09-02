import { z } from "zod";
import { db } from "@/lib/db";
import {
  fail,
  handleError,
  ok,
  parseBody,
  planFor,
  requireUser,
  withinLimit,
  writeAudit,
} from "@/lib/api";
import { overlappingFields } from "@/lib/integrations/registry";
import { enqueue, nextRunFor } from "@/lib/queue";
import type { RecordType } from "@/lib/integrations/types";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const syncs = await db.syncConfig.findMany({
    where: { orgId: auth.user.orgId },
    orderBy: { createdAt: "desc" },
    include: {
      source: { select: { id: true, displayName: true, provider: true, status: true } },
      target: { select: { id: true, displayName: true, provider: true, status: true } },
      _count: { select: { conflicts: true } },
    },
  });

  return ok({ syncs });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Give this sync a name.").max(80),
  recordType: z.enum(["profile", "contact"]),
  sourceConnectionId: z.string().min(1),
  targetConnectionId: z.string().min(1),
  fields: z.array(z.string()).min(1, "Choose at least one field to keep synchronized."),
  direction: z.enum(["ONE_WAY", "TWO_WAY"]).default("ONE_WAY"),
  frequency: z.enum(["REALTIME", "EVERY_15_MIN", "HOURLY", "DAILY", "MANUAL"]).default("HOURLY"),
  conflictPolicy: z.enum(["ASK", "PREFER_SOURCE", "PREFER_TARGET", "NEWEST_WINS"]).default("ASK"),
  propagateDeletes: z.boolean().default(false),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, createSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  if (input.sourceConnectionId === input.targetConnectionId) {
    return fail("A sync needs two different services.", 422, "same_connection");
  }

  const [source, target] = await Promise.all([
    db.connection.findFirst({ where: { id: input.sourceConnectionId, orgId: auth.user.orgId } }),
    db.connection.findFirst({ where: { id: input.targetConnectionId, orgId: auth.user.orgId } }),
  ]);
  if (!source || !target) {
    return fail("One of those connections could not be found.", 404, "not_found");
  }

  const plan = await planFor(auth.user.orgId);
  const existing = await db.syncConfig.count({ where: { orgId: auth.user.orgId } });
  if (!withinLimit(existing, plan.maxSyncs)) {
    return fail(
      `Your ${plan.name} plan includes ${plan.maxSyncs} syncs. Upgrade to create more.`,
      402,
      "limit_reached",
    );
  }

  // Refuse a configuration that could never succeed: the destination has to be
  // able to accept every field, and the source has to be able to supply it.
  const allowed = overlappingFields(
    source.provider,
    target.provider,
    input.recordType as RecordType,
  );
  const impossible = input.fields.filter((f) => !allowed.includes(f));
  if (impossible.length) {
    return fail(
      `${target.displayName} cannot accept: ${impossible.join(", ")}. Choose different fields.`,
      422,
      "unsupported_fields",
    );
  }

  try {
    const sync = await db.syncConfig.create({
      data: {
        orgId: auth.user.orgId,
        name: input.name,
        recordType: input.recordType,
        sourceConnectionId: input.sourceConnectionId,
        targetConnectionId: input.targetConnectionId,
        fields: input.fields,
        direction: input.direction,
        frequency: input.frequency,
        conflictPolicy: input.conflictPolicy,
        propagateDeletes: input.propagateDeletes,
        nextRunAt: input.frequency === "MANUAL" ? null : nextRunFor(input.frequency),
      },
    });

    // Run once immediately so the user sees the result rather than waiting for
    // the first scheduled tick.
    await enqueue({ orgId: auth.user.orgId, syncConfigId: sync.id });

    await writeAudit({
      orgId: auth.user.orgId,
      userId: auth.user.id,
      action: "sync.created",
      target: sync.id,
      metadata: { fields: input.fields, direction: input.direction },
    });

    return ok({ id: sync.id }, { status: 201 });
  } catch (error) {
    return handleError(error, "create sync");
  }
}
