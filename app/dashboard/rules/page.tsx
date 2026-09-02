import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { planFor } from "@/lib/api";
import { tryGetIntegration } from "@/lib/integrations/registry";
import { CANONICAL_PROFILE_FIELDS } from "@/lib/integrations/fields";
import { RulesClient } from "./client";

export const metadata = { title: "Rules" };
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const session = await requireSession();

  const [rules, connections, plan] = await Promise.all([
    db.rule.findMany({ where: { orgId: session.orgId }, orderBy: { createdAt: "desc" } }),
    db.connection.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "asc" },
      select: { id: true, provider: true, displayName: true },
    }),
    planFor(session.orgId),
  ]);

  // Each connection advertises which fields it can read and which it can write,
  // so the builder can constrain both halves of a rule to what is possible.
  const connectionFields = connections.map((connection) => {
    const descriptor = tryGetIntegration(connection.provider)?.descriptor;
    const profile = descriptor?.capabilities.fields.profile ?? [];
    return {
      id: connection.id,
      displayName: connection.displayName,
      readable: profile.map((f) => ({ key: f.key, label: f.label })),
      writable: profile.filter((f) => f.writable).map((f) => ({ key: f.key, label: f.label })),
    };
  });

  return (
    <RulesClient
      rules={rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        trigger: rule.trigger as { connectionId: string; field: string; recordType: string },
        conditions: rule.conditions as { field: string; operator: string; value?: string }[],
        actions: rule.actions as { connectionId: string; field: string; value: string }[],
        fireCount: rule.fireCount,
        lastFiredAt: rule.lastFiredAt?.toISOString() ?? null,
      }))}
      connections={connectionFields}
      fieldLabels={Object.fromEntries(
        Object.entries(CANONICAL_PROFILE_FIELDS).map(([k, v]) => [k, v.label]),
      )}
      advancedRules={plan.advancedRules}
      planName={plan.name}
    />
  );
}
