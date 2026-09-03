import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui";
import { PageHeader, EventRow } from "../components";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "SUCCESS", label: "Synced" },
  { key: "CONFLICT", label: "Conflicts" },
  { key: "ERROR", label: "Failures" },
] as const;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const session = await requireSession();
  const { level } = await searchParams;
  const active = FILTERS.some((f) => f.key === level) ? level! : "all";

  const events = await db.syncEvent.findMany({
    where: {
      orgId: session.orgId,
      ...(active === "all" ? {} : { level: active as "SUCCESS" | "ERROR" | "CONFLICT" }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-7 lg:py-10">
      <PageHeader
        title="Activity"
        subtitle="Every change Auralis has made, and everything it decided not to."
      />

      <div className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => {
          const on = active === filter.key;
          return (
            <Link
              key={filter.key}
              href={filter.key === "all" ? "/dashboard/activity" : `/dashboard/activity?level=${filter.key}`}
              className="badge no-underline"
              style={{
                background: on ? "var(--ink)" : "var(--raised)",
                color: on ? "var(--paper)" : "var(--ink-soft)",
                height: 28,
                paddingInline: 12,
              }}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-5">
        {events.length === 0 ? (
          <EmptyState
            title={active === "all" ? "Nothing yet" : "Nothing matching that filter"}
            body={
              active === "all"
                ? "Once a sync runs, every field Auralis changes will be recorded here with the services involved."
                : "Try a different filter, or check back after the next sync runs."
            }
            action={
              active === "all" ? (
                <Link href="/dashboard/connections" className="btn btn-primary btn-sm">
                  Connect a service
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {events.length === 100 && (
        <p className="mt-4 text-[12.5px] text-center" style={{ color: "var(--ink-faint)" }}>
          Showing the 100 most recent events.
        </p>
      )}
    </div>
  );
}
