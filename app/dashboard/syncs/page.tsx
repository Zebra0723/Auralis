import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tryGetIntegration } from "@/lib/integrations/registry";
import { CANONICAL_PROFILE_FIELDS } from "@/lib/integrations/fields";
import { SyncsClient } from "./client";
import type { RecordType } from "@/lib/integrations/types";

export const metadata = { title: "Syncs" };
export const dynamic = "force-dynamic";

export default async function SyncsPage() {
  const session = await requireSession();

  const [syncs, connections, conflicts] = await Promise.all([
    db.syncConfig.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
      include: {
        source: { select: { id: true, displayName: true, provider: true } },
        target: { select: { id: true, displayName: true, provider: true } },
      },
    }),
    db.connection.findMany({
      where: { orgId: session.orgId, status: { not: "DISABLED" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, provider: true, displayName: true, accountLabel: true, status: true },
    }),
    db.conflict.findMany({
      where: { orgId: session.orgId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  /**
   * Field capability is resolved on the server from the provider registry, so
   * the builder can only ever offer combinations that are genuinely possible.
   */
  const capabilities = connections.map((connection) => {
    const descriptor = tryGetIntegration(connection.provider)?.descriptor;
    const forType = (type: RecordType) =>
      (descriptor?.capabilities.fields[type] ?? []).map((f) => ({
        key: f.key,
        label: f.label,
        writable: f.writable,
      }));
    return {
      connectionId: connection.id,
      recordTypes: descriptor?.capabilities.recordTypes ?? [],
      profile: forType("profile"),
      contact: forType("contact"),
      mark: descriptor?.mark ?? "?",
      accent: descriptor?.accent ?? "#666",
    };
  });

  return (
    <SyncsClient
      syncs={syncs.map((s) => ({
        id: s.id,
        name: s.name,
        recordType: s.recordType,
        fields: s.fields,
        direction: s.direction,
        frequency: s.frequency,
        conflictPolicy: s.conflictPolicy,
        propagateDeletes: s.propagateDeletes,
        enabled: s.enabled,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        source: s.source,
        target: s.target,
      }))}
      connections={connections}
      capabilities={capabilities}
      conflicts={conflicts.map((c) => ({
        id: c.id,
        field: c.field,
        fieldLabel: CANONICAL_PROFILE_FIELDS[c.field]?.label ?? c.field,
        sourceValue: c.sourceValue,
        targetValue: c.targetValue,
        sourceLabel: c.sourceLabel,
        targetLabel: c.targetLabel,
        createdAt: c.createdAt.toISOString(),
      }))}
      fieldLabels={Object.fromEntries(
        Object.entries(CANONICAL_PROFILE_FIELDS).map(([k, v]) => [k, v.label]),
      )}
    />
  );
}
