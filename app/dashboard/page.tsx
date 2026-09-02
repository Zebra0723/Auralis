import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { planFor } from "@/lib/api";
import { allDescriptors, connectableState, tryGetIntegration } from "@/lib/integrations/registry";
import { EmptyState, ProviderMark, relativeTime } from "@/components/ui";
import { PageHeader, Section, StatTile, EventRow } from "./components";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await requireSession();
  const orgId = session.orgId;

  const [
    connections,
    activeSyncs,
    recentEvents,
    openConflicts,
    brokenConnections,
    opsThisMonth,
    plan,
  ] = await Promise.all([
    db.connection.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    db.syncConfig.count({ where: { orgId, enabled: true } }),
    db.syncEvent.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.conflict.findMany({
      where: { orgId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.connection.findMany({
      where: { orgId, status: { in: ["NEEDS_REAUTH", "ERROR"] } },
    }),
    db.syncEvent.count({
      where: {
        orgId,
        level: "SUCCESS",
        createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
      },
    }),
    planFor(orgId),
  ]);

  const connectedKeys = new Set(connections.map((c) => c.provider));
  const suggestions = allDescriptors()
    .filter((d) => !connectedKeys.has(d.key) && connectableState(d).connectable)
    .slice(0, 4);

  const needsAttention = brokenConnections.length + openConflicts.length;

  return (
    <div className="mx-auto max-w-[980px] px-5 lg:px-8 py-7 lg:py-10">
      <PageHeader
        title={`Good to see you${session.name ? `, ${session.name.split(" ")[0]}` : ""}`}
        subtitle={
          connections.length === 0
            ? "Connect your first service to get started."
            : needsAttention > 0
              ? "A few things need a decision from you."
              : "Everything is in step. Nothing needs you right now."
        }
      />

      {/* Anything requiring a human decision comes before the metrics. */}
      {needsAttention > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {brokenConnections.map((connection) => {
            const descriptor = tryGetIntegration(connection.provider)?.descriptor;
            return (
              <div
                key={connection.id}
                className="card flex flex-wrap items-center gap-3 p-4"
                style={{ borderColor: "var(--amber)", background: "var(--amber-soft)" }}
              >
                {descriptor && <ProviderMark mark={descriptor.mark} accent={descriptor.accent} size={30} />}
                <div className="flex-1 min-w-[200px]">
                  <div className="text-[14px] font-medium">{connection.displayName} needs reconnecting</div>
                  <div className="text-[13px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                    {connection.statusDetail ??
                      `Your ${connection.displayName} connection has expired. Reconnect it to continue syncing.`}
                  </div>
                </div>
                <Link href="/dashboard/connections" className="btn btn-secondary btn-sm">
                  Reconnect
                </Link>
              </div>
            );
          })}

          {openConflicts.length > 0 && (
            <div className="card flex flex-wrap items-center gap-3 p-4" style={{ borderColor: "var(--line)" }}>
              <div className="flex-1 min-w-[200px]">
                <div className="text-[14px] font-medium">
                  {openConflicts.length} conflict{openConflicts.length === 1 ? "" : "s"} waiting on you
                </div>
                <div className="text-[13px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                  Two services disagree. Nothing was changed while these are open.
                </div>
              </div>
              <Link href="/dashboard/syncs" className="btn btn-primary btn-sm">Review</Link>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Connected accounts" value={connections.length} hint={`of ${plan.maxConnections === -1 ? "unlimited" : plan.maxConnections} on ${plan.name}`} />
        <StatTile label="Active syncs" value={activeSyncs} />
        <StatTile label="Fields synchronized" value={opsThisMonth} hint="last 30 days" />
        <StatTile
          label="Needs attention"
          value={needsAttention}
          tone={needsAttention > 0 ? "amber" : "signal"}
        />
      </div>

      <Section title="Recent activity" action={<Link href="/dashboard/activity" className="btn btn-ghost btn-sm">View all</Link>}>
        {recentEvents.length === 0 ? (
          <EmptyState
            title="Nothing has happened yet"
            body="Once you connect a service and set up a sync, every change Auralis makes will appear here."
            action={<Link href="/dashboard/connections" className="btn btn-primary btn-sm">Connect a service</Link>}
          />
        ) : (
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {recentEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </Section>

      {suggestions.length > 0 && (
        <Section title="Suggested connections">
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.map((descriptor) => (
              <Link
                key={descriptor.key}
                href="/dashboard/connections"
                className="card card-pad flex items-center gap-3 no-underline transition-colors duration-150 hover:border-[var(--ink-faint)]"
              >
                <ProviderMark mark={descriptor.mark} accent={descriptor.accent} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
                    {descriptor.name}
                  </div>
                  <div className="text-[12.5px] truncate" style={{ color: "var(--ink-faint)" }}>
                    {descriptor.category}
                  </div>
                </div>
                <span className="text-[13px]" style={{ color: "var(--signal)" }}>Connect</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {connections.length > 0 && (
        <Section title="Your connections">
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {connections.map((connection) => {
              const descriptor = tryGetIntegration(connection.provider)?.descriptor;
              return (
                <div key={connection.id} className="flex items-center gap-3 p-4">
                  {descriptor && <ProviderMark mark={descriptor.mark} accent={descriptor.accent} size={30} />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium truncate">{connection.displayName}</div>
                    <div className="text-[12.5px] truncate" style={{ color: "var(--ink-faint)" }}>
                      {connection.accountLabel ?? "Connected"}
                      {connection.lastSyncedAt && ` · synced ${relativeTime(connection.lastSyncedAt)}`}
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      connection.status === "ACTIVE" ? "badge-signal"
                      : connection.status === "NEEDS_REAUTH" ? "badge-amber"
                      : "badge-danger"
                    }`}
                  >
                    {connection.status === "ACTIVE" ? "Active"
                      : connection.status === "NEEDS_REAUTH" ? "Reconnect"
                      : "Error"}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
