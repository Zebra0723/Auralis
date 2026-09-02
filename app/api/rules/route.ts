import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, parseBody, planFor, requireUser, writeAudit } from "@/lib/api";

const triggerSchema = z.object({
  connectionId: z.string().min(1),
  recordType: z.enum(["profile", "contact"]),
  field: z.string().min(1),
});

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "not_equals", "contains", "starts_with", "is_empty", "is_not_empty"]),
  value: z.string().max(500).optional(),
});

const actionSchema = z.object({
  type: z.literal("set_field"),
  connectionId: z.string().min(1),
  field: z.string().min(1),
  value: z.string().max(500),
});

const createSchema = z.object({
  name: z.string().trim().min(1, "Give this rule a name.").max(80),
  trigger: triggerSchema,
  conditions: z.array(conditionSchema).max(10).default([]),
  actions: z.array(actionSchema).min(1, "A rule needs at least one action.").max(10),
});

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const rules = await db.rule.findMany({
    where: { orgId: auth.user.orgId },
    orderBy: { createdAt: "desc" },
  });
  return ok({ rules });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await parseBody(request, createSchema);
  if (!body.ok) return body.response;

  const plan = await planFor(auth.user.orgId);
  // Multi-condition rules are the Plus feature; a single trigger and action is
  // available on every plan.
  if (!plan.advancedRules && body.data.conditions.length > 0) {
    return fail(
      `Conditional rules are part of Plus. Your ${plan.name} plan supports rules without conditions.`,
      402,
      "limit_reached",
    );
  }

  // Every referenced connection must belong to this workspace.
  const referenced = new Set([
    body.data.trigger.connectionId,
    ...body.data.actions.map((a) => a.connectionId),
  ]);
  referenced.delete("any");
  const owned = await db.connection.count({
    where: { orgId: auth.user.orgId, id: { in: [...referenced] } },
  });
  if (owned !== referenced.size) {
    return fail("One of those connections could not be found.", 404, "not_found");
  }

  try {
    const rule = await db.rule.create({
      data: {
        orgId: auth.user.orgId,
        name: body.data.name,
        trigger: body.data.trigger,
        conditions: body.data.conditions,
        actions: body.data.actions,
      },
    });

    await writeAudit({
      orgId: auth.user.orgId,
      userId: auth.user.id,
      action: "rule.created",
      target: rule.id,
      metadata: { name: rule.name },
    });

    return ok({ id: rule.id }, { status: 201 });
  } catch (error) {
    return handleError(error, "create rule");
  }
}
