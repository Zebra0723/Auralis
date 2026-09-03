import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { planFor } from "@/lib/api";
import { tryGetIntegration } from "@/lib/integrations/registry";
import { CANONICAL_PROFILE_FIELDS } from "@/lib/integrations/fields";
import { relativeTime, ProviderMark } from "@/components/ui";
import { PageHeader, Section } from "../components";
import { VaultEditor } from "./vault-editor";
import { latestRelease, releases, VERSION_LABEL } from "@/lib/changelog";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();

  const [connections, plan, canonical, auditLogs, sessions] = await Promise.all([
    db.connection.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "asc" },
    }),
    planFor(session.orgId),
    db.canonicalRecord.findFirst({
      where: { orgId: session.orgId, recordType: "profile" },
      orderBy: { createdAt: "asc" },
    }),
    db.auditLog.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.session.findMany({
      where: { userId: session.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-7 lg:py-10">
      <PageHeader
        title="Settings"
        subtitle="Your workspace, your canonical record, and what each service is allowed to do."
      />

      <Section title="Your canonical record">
        <div className="card card-pad">
          <p className="text-[13.5px] mb-5" style={{ color: "var(--ink-soft)" }}>
            This is the value Auralis treats as correct. Change something here and it
            propagates to every connected service that supports the field and has a
            sync pointing at it.
          </p>
          <VaultEditor
            initial={(canonical?.fields ?? {}) as Record<string, string | null>}
            fields={Object.values(CANONICAL_PROFILE_FIELDS).map((f) => ({
              key: f.key,
              label: f.label,
              type: f.type,
            }))}
          />
        </div>
      </Section>

      <Section title="Security">
        <div className="card card-pad">
          <h3 className="title text-[15px]">How Auralis holds your credentials</h3>
          <ul className="mt-3 flex flex-col gap-2 list-none p-0 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
            <li>Your password for any connected service is never sent to Auralis.</li>
            <li>Access tokens are encrypted with AES-256-GCM before they are stored.</li>
            <li>Tokens are decrypted only inside the process that calls the provider, and are never returned by any API route.</li>
            <li>Disconnecting a service revokes its token where the provider allows it, then deletes our copy.</li>
          </ul>
        </div>

        <h3 className="eyebrow mt-6 mb-3">Connected accounts and permissions</h3>
        {connections.length === 0 ? (
          <p className="text-[13.5px]" style={{ color: "var(--ink-faint)" }}>
            No services connected yet.
          </p>
        ) : (
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {connections.map((connection) => {
              const descriptor = tryGetIntegration(connection.provider)?.descriptor;
              const fields = descriptor?.capabilities.fields.profile ?? [];
              const writable = fields.filter((f) => f.writable);
              return (
                <div key={connection.id} className="p-4">
                  <div className="flex items-center gap-3">
                    {descriptor && <ProviderMark mark={descriptor.mark} accent={descriptor.accent} size={30} providerKey={descriptor.key} />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium">{connection.displayName}</div>
                      <div className="text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
                        {connection.accountLabel ?? "Connected"} · added {relativeTime(connection.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-[12.5px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
                    <div>
                      <span style={{ color: "var(--ink-faint)" }}>Auralis can read:</span>{" "}
                      {fields.length ? fields.map((f) => f.label).join(", ") : "nothing"}
                    </div>
                    <div className="mt-1">
                      <span style={{ color: "var(--ink-faint)" }}>Auralis can change:</span>{" "}
                      {writable.length ? writable.map((f) => f.label).join(", ") : "nothing — this connection is read-only"}
                    </div>
                    {connection.scopes.length > 0 && (
                      <div className="mt-1.5 font-mono text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
                        {connection.scopes.join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h3 className="eyebrow mt-6 mb-3">Active sessions</h3>
        <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
          {sessions.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13.5px] truncate">{s.userAgent ?? "Unknown device"}</div>
                <div className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
                  Signed in {relativeTime(s.createdAt)}
                  {s.ip && ` · ${s.ip}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Plan">
        <div className="card card-pad flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <span className="title text-[16px]">{plan.name}</span>
              <span className="badge badge-signal">Current</span>
            </div>
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
              {plan.maxConnections === -1 ? "Unlimited" : plan.maxConnections} connections ·{" "}
              {plan.maxSyncs === -1 ? "unlimited" : plan.maxSyncs} syncs ·{" "}
              {plan.monthlyOps.toLocaleString("en-GB")} sync operations a month
            </p>
          </div>
          <div
            className="text-[12.5px] rounded-[6px] px-3 py-2.5"
            style={{ background: "var(--raised)", color: "var(--ink-soft)" }}
          >
            Billing is not enabled on this deployment, so plans cannot be changed here yet.
          </div>
        </div>
      </Section>

      <Section title="Version">
        <div className="card card-pad">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="badge badge-signal"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {VERSION_LABEL}
            </span>
            <span className="text-[14px] font-medium">{latestRelease.summary}</span>
          </div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--ink-faint)" }}>
            Released {latestRelease.date}. {releases.length} versions so far.
          </p>
          <a
            href="/changelog"
            className="link-underline text-[13.5px] inline-block mt-3"
            style={{ color: "var(--accent)" }}
          >
            See everything that has changed
          </a>
        </div>
      </Section>

      {plan.auditLogs ? (
        <Section title="Audit log">
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex items-center justify-between gap-3">
                <span className="font-mono text-[12.5px]">{log.action}</span>
                <span className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
                  {relativeTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Audit log">
          <div className="card card-pad text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
            Auralis records every action on your workspace. Exportable audit logs are part
            of the Business plan.
          </div>
        </Section>
      )}
    </div>
  );
}
