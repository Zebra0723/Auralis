import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { planFor } from "@/lib/api";
import { allDescriptors, connectableState } from "@/lib/integrations/registry";
import { ConnectionsClient } from "./client";

export const metadata = { title: "Connections" };
export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const [connections, plan] = await Promise.all([
    db.connection.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        provider: true,
        displayName: true,
        accountLabel: true,
        status: true,
        statusDetail: true,
        scopes: true,
        lastSyncedAt: true,
      },
    }),
    planFor(session.orgId),
  ]);

  // The descriptor plus its configuration state is everything the client needs;
  // no credential or secret crosses this boundary.
  const catalogue = allDescriptors().map((descriptor) => {
    const state = connectableState(descriptor);
    return {
      key: descriptor.key,
      name: descriptor.name,
      category: descriptor.category,
      blurb: descriptor.blurb,
      authMethod: descriptor.authMethod,
      accent: descriptor.accent,
      mark: descriptor.mark,
      setupUrl: descriptor.setupUrl ?? null,
      setupHint: descriptor.setupHint ?? null,
      status: descriptor.status,
      connectable: state.connectable,
      unavailableReason: state.connectable ? null : state.reason,
      missingEnv: state.connectable ? [] : state.missingEnv,
      writableFieldCount: (descriptor.capabilities.fields.profile ?? []).filter((f) => f.writable).length,
      readableFieldCount: (descriptor.capabilities.fields.profile ?? []).length,
    };
  });

  return (
    <ConnectionsClient
      connections={connections.map((c) => ({
        ...c,
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
      }))}
      catalogue={catalogue}
      plan={{ name: plan.name, maxConnections: plan.maxConnections }}
      flash={{ error: params.error ?? null, connected: params.connected ?? null }}
    />
  );
}
