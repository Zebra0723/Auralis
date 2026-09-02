import { db } from "@/lib/db";
import { getIntegration } from "@/lib/integrations/registry";
import { getConnectionContext } from "@/lib/sync/connection-context";
import type { RecordType } from "@/lib/integrations/types";

/**
 * Rules are stored as data, not code: a trigger, a list of conditions and a list
 * of actions. The visual builder writes these shapes and this evaluator reads
 * them, so a user never needs to write an expression and we never need to
 * evaluate arbitrary strings.
 */

export interface RuleTrigger {
  connectionId: string | "any";
  recordType: RecordType;
  field: string | "any";
}

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "is_empty"
  | "is_not_empty";

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: string;
}

export interface RuleAction {
  type: "set_field";
  connectionId: string;
  field: string;
  /** Literal value, or "{{value}}" for the value that triggered the rule. */
  value: string;
}

export interface ChangeEvent {
  orgId: string;
  connectionId: string;
  recordType: RecordType;
  field: string;
  value: string | null;
}

function matches(condition: RuleCondition, fields: Record<string, unknown>): boolean {
  const raw = fields[condition.field];
  const actual = raw === null || raw === undefined ? "" : String(raw);
  const expected = condition.value ?? "";

  switch (condition.operator) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "contains":
      return actual.toLowerCase().includes(expected.toLowerCase());
    case "starts_with":
      return actual.toLowerCase().startsWith(expected.toLowerCase());
    case "is_empty":
      return actual === "";
    case "is_not_empty":
      return actual !== "";
    default:
      return false;
  }
}

export async function runRulesForChange(change: ChangeEvent): Promise<number> {
  const rules = await db.rule.findMany({
    where: { orgId: change.orgId, enabled: true },
  });
  if (rules.length === 0) return 0;

  const canonical = await db.canonicalRecord.findFirst({
    where: { orgId: change.orgId, recordType: change.recordType },
    orderBy: { createdAt: "asc" },
  });
  const canonicalFields = (canonical?.fields ?? {}) as Record<string, unknown>;

  let fired = 0;

  for (const rule of rules) {
    const trigger = rule.trigger as unknown as RuleTrigger;
    if (trigger.connectionId !== "any" && trigger.connectionId !== change.connectionId) continue;
    if (trigger.field !== "any" && trigger.field !== change.field) continue;
    if (trigger.recordType !== change.recordType) continue;

    const conditions = (rule.conditions ?? []) as unknown as RuleCondition[];
    if (!conditions.every((c) => matches(c, canonicalFields))) continue;

    const actions = (rule.actions ?? []) as unknown as RuleAction[];
    for (const action of actions) {
      if (action.type !== "set_field") continue;
      try {
        await applyAction(change, action);
      } catch (error) {
        await db.syncEvent.create({
          data: {
            orgId: change.orgId,
            level: "ERROR",
            title: `Rule "${rule.name}" could not complete`,
            detail:
              error instanceof Error
                ? error.message
                : "The action could not be applied to the destination service.",
          },
        });
      }
    }

    await db.rule.update({
      where: { id: rule.id },
      data: { lastFiredAt: new Date(), fireCount: { increment: 1 } },
    });

    await db.syncEvent.create({
      data: {
        orgId: change.orgId,
        level: "INFO",
        title: `Rule "${rule.name}" ran`,
        detail: `Triggered by a change to ${change.field}.`,
        field: change.field,
      },
    });

    fired++;
  }

  return fired;
}

async function applyAction(change: ChangeEvent, action: RuleAction): Promise<void> {
  const connection = await db.connection.findFirst({
    where: { id: action.connectionId, orgId: change.orgId },
  });
  if (!connection || connection.status !== "ACTIVE") return;

  const integration = getIntegration(connection.provider);
  const ctx = await getConnectionContext(connection);

  const records = await integration.getData(ctx, change.recordType);
  const target = records[0];
  if (!target) return;

  const value = action.value === "{{value}}" ? change.value : action.value;
  await integration.updateData(ctx, change.recordType, target.externalId, {
    [action.field]: value,
  });
}
