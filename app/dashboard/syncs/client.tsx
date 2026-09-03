"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ConfirmDialog,
  EmptyState,
  ProviderMark,
  relativeTime,
  useToast,
} from "@/components/ui";
import { PageHeader } from "../components";

interface ConnectionOption {
  id: string;
  provider: string;
  displayName: string;
  accountLabel: string | null;
  status: string;
}

interface Capability {
  connectionId: string;
  recordTypes: string[];
  profile: { key: string; label: string; writable: boolean }[];
  contact: { key: string; label: string; writable: boolean }[];
  mark: string;
  accent: string;
}

interface SyncRow {
  id: string;
  name: string;
  recordType: string;
  fields: string[];
  direction: string;
  frequency: string;
  conflictPolicy: string;
  propagateDeletes: boolean;
  enabled: boolean;
  lastRunAt: string | null;
  source: { id: string; displayName: string; provider: string };
  target: { id: string; displayName: string; provider: string };
}

interface ConflictRow {
  id: string;
  field: string;
  fieldLabel: string;
  sourceValue: string | null;
  targetValue: string | null;
  sourceLabel: string;
  targetLabel: string;
  createdAt: string;
}

const FREQUENCY_LABEL: Record<string, string> = {
  REALTIME: "As changes happen",
  EVERY_15_MIN: "Every 15 minutes",
  HOURLY: "Hourly",
  DAILY: "Daily",
  MANUAL: "Only when I ask",
};

export function SyncsClient({
  syncs,
  connections,
  capabilities,
  conflicts,
  fieldLabels,
}: {
  syncs: SyncRow[];
  connections: ConnectionOption[];
  capabilities: Capability[];
  conflicts: ConflictRow[];
  fieldLabels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [building, setBuilding] = useState(false);
  const [deleting, setDeleting] = useState<SyncRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function runNow(sync: SyncRow) {
    const res = await fetch(`/api/syncs/${sync.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runNow: true }),
    });
    if (res.ok) {
      toast(`${sync.name} queued. It will run within a few seconds.`, "success");
      router.refresh();
    } else {
      const data = await res.json();
      toast(data.error ?? "That sync could not be queued.", "error");
    }
  }

  async function toggle(sync: SyncRow) {
    const res = await fetch(`/api/syncs/${sync.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !sync.enabled }),
    });
    if (res.ok) {
      toast(sync.enabled ? `${sync.name} paused.` : `${sync.name} resumed.`, "success");
      router.refresh();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res = await fetch(`/api/syncs/${deleting.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      toast(`${deleting.name} removed.`, "success");
      setDeleting(null);
      router.refresh();
    } else {
      toast("That sync could not be removed.", "error");
    }
  }

  return (
    <div className="mx-auto max-w-[980px] px-5 lg:px-8 py-7 lg:py-10">
      <PageHeader
        title="Syncs"
        subtitle="What Auralis keeps in step, and between which services."
        action={
          connections.length >= 2 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setBuilding(true)}>
              New sync
            </button>
          )
        }
      />

      {conflicts.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3" style={{ color: "var(--amber)" }}>
            Conflicts needing a decision
          </h2>
          <div className="flex flex-col gap-2">
            {conflicts.map((conflict) => (
              <ConflictCard key={conflict.id} conflict={conflict} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        {connections.length < 2 ? (
          <EmptyState
            title="Connect two services first"
            body="A sync moves information between two connected accounts, so you need at least two before you can create one."
            action={<Link href="/dashboard/connections" className="btn btn-primary btn-sm">Go to connections</Link>}
          />
        ) : syncs.length === 0 ? (
          <EmptyState
            title="No syncs yet"
            body="Choose a source, a destination and the fields worth keeping in step. Auralis handles the rest in the background."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setBuilding(true)}>
                Create your first sync
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {syncs.map((sync) => (
              <div key={sync.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-medium">{sync.name}</span>
                      {!sync.enabled && <span className="badge badge-neutral">Paused</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[13px]" style={{ color: "var(--ink-soft)" }}>
                      <span>{sync.source.displayName}</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        {sync.direction === "TWO_WAY" ? (
                          <path d="M7 7l-4 5 4 5M17 7l4 5-4 5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
                        ) : (
                          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </svg>
                      <span>{sync.target.displayName}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sync.fields.map((field) => (
                        <span key={field} className="badge badge-neutral">
                          {fieldLabels[field] ?? field}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
                      {FREQUENCY_LABEL[sync.frequency]}
                      {sync.lastRunAt ? ` · last ran ${relativeTime(sync.lastRunAt)}` : " · not run yet"}
                      {sync.propagateDeletes && " · deletions propagate"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="switch"
                      data-on={sync.enabled}
                      onClick={() => toggle(sync)}
                      aria-label={sync.enabled ? `Pause ${sync.name}` : `Resume ${sync.name}`}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => runNow(sync)}>
                      Run now
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(sync)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {building && (
        <SyncBuilder
          connections={connections}
          capabilities={capabilities}
          onClose={() => setBuilding(false)}
          onCreated={() => {
            setBuilding(false);
            toast("Sync created. Running it now.", "success");
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Remove ${deleting?.name ?? ""}?`}
        destructive
        busy={busy}
        confirmLabel="Remove sync"
        body="Auralis will stop keeping these fields in step. Values already written to your services stay as they are."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------- conflicts */

function ConflictCard({ conflict }: { conflict: ConflictRow }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergedValue, setMergedValue] = useState(
    conflict.sourceValue ?? conflict.targetValue ?? "",
  );

  async function resolve(resolution: string, value?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/conflicts/${conflict.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, mergedValue: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "That conflict could not be resolved.", "error");
        return;
      }
      toast(`${conflict.fieldLabel} is consistent again.`, "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4" style={{ borderColor: "var(--amber)" }}>
      <div className="flex items-center gap-2">
        <span className="badge badge-amber">Conflict detected</span>
        <span className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
          {conflict.fieldLabel} · {relativeTime(conflict.createdAt)}
        </span>
      </div>

      <p className="mt-2.5 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
        Both services changed this field since Auralis last checked, so nothing was
        overwritten. Choose which value is right.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ValueBox label={conflict.sourceLabel} value={conflict.sourceValue} />
        <ValueBox label={conflict.targetLabel} value={conflict.targetValue} />
      </div>

      {merging && (
        <div className="mt-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Merged value</span>
            <input
              className="input"
              value={mergedValue}
              onChange={(e) => setMergedValue(e.target.value)}
              autoFocus
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {merging ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => resolve("merge", mergedValue)}
            >
              Save merged value
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMerging(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => resolve("keep_source")}>
              Keep {conflict.sourceLabel}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => resolve("keep_target")}>
              Keep {conflict.targetLabel}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setMerging(true)}>
              Merge
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => resolve("always_source")}>
              Always prefer {conflict.sourceLabel}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => resolve("always_target")}>
              Always prefer {conflict.targetLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ValueBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-[8px] p-3" style={{ background: "var(--raised)" }}>
      <div className="text-[11.5px] font-medium" style={{ color: "var(--ink-faint)" }}>
        {label}
      </div>
      <div className="mt-1.5 text-[14px] break-words">
        {value === null || value === "" ? (
          <span style={{ color: "var(--ink-faint)", fontStyle: "italic" }}>Empty</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- builder */

function SyncBuilder({
  connections,
  capabilities,
  onClose,
  onCreated,
}: {
  connections: ConnectionOption[];
  capabilities: Capability[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [sourceId, setSourceId] = useState(connections[0]?.id ?? "");
  const [targetId, setTargetId] = useState(connections[1]?.id ?? "");
  const [recordType, setRecordType] = useState<"profile" | "contact">("profile");
  const [selected, setSelected] = useState<string[]>([]);
  const [direction, setDirection] = useState("ONE_WAY");
  const [frequency, setFrequency] = useState("HOURLY");
  const [conflictPolicy, setConflictPolicy] = useState("ASK");
  const [propagateDeletes, setPropagateDeletes] = useState(false);
  const [busy, setBusy] = useState(false);

  const sourceCap = capabilities.find((c) => c.connectionId === sourceId);
  const targetCap = capabilities.find((c) => c.connectionId === targetId);

  /**
   * Only fields the source can read AND the destination can write are offered.
   * Anything else could never succeed, so it is never presented as an option.
   */
  const availableFields = useMemo(() => {
    if (!sourceCap || !targetCap) return [];
    const readable = new Set(
      (recordType === "profile" ? sourceCap.profile : sourceCap.contact).map((f) => f.key),
    );
    return (recordType === "profile" ? targetCap.profile : targetCap.contact)
      .filter((f) => f.writable && readable.has(f.key));
  }, [sourceCap, targetCap, recordType]);

  const sourceConn = connections.find((c) => c.id === sourceId);
  const targetConn = connections.find((c) => c.id === targetId);

  async function submit() {
    if (!selected.length) {
      toast("Choose at least one field to keep synchronized.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/syncs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${sourceConn?.displayName} to ${targetConn?.displayName}`,
          recordType,
          sourceConnectionId: sourceId,
          targetConnectionId: targetId,
          fields: selected,
          direction,
          frequency,
          conflictPolicy,
          propagateDeletes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "That sync could not be created.", "error");
        return;
      }
      onCreated();
    } catch {
      toast("We could not reach Auralis. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto fade"
      style={{ background: "rgba(10, 12, 11, 0.45)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-[540px] p-6 my-auto"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create a sync"
      >
        <h2 className="title text-[18px]">New sync</h2>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Source</span>
            <select
              className="input"
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value);
                setSelected([]);
              }}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === targetId}>
                  {c.displayName}{c.accountLabel ? ` — ${c.accountLabel}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Data</span>
            <select
              className="input"
              value={recordType}
              onChange={(e) => {
                setRecordType(e.target.value as "profile" | "contact");
                setSelected([]);
              }}
            >
              <option value="profile">Profile</option>
              <option value="contact">Contacts</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Destination</span>
            <select
              className="input"
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setSelected([]);
              }}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === sourceId}>
                  {c.displayName}{c.accountLabel ? ` — ${c.accountLabel}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="eyebrow">Fields to keep synchronized</span>
            {availableFields.length === 0 ? (
              <p
                className="text-[13px] rounded-[6px] px-3 py-2.5"
                style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
              >
                {targetConn?.displayName} cannot accept any of the fields{" "}
                {sourceConn?.displayName} provides for this record type. Try a different
                destination.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableFields.map((field) => {
                  const on = selected.includes(field.key);
                  return (
                    <button
                      key={field.key}
                      type="button"
                      className="badge"
                      style={{
                        background: on ? "var(--accent-soft)" : "var(--raised)",
                        color: on ? "var(--accent)" : "var(--ink-soft)",
                        height: 28,
                        paddingInline: 11,
                        cursor: "pointer",
                        border: `1px solid ${on ? "var(--accent)" : "transparent"}`,
                      }}
                      onClick={() =>
                        setSelected((current) =>
                          current.includes(field.key)
                            ? current.filter((f) => f !== field.key)
                            : [...current, field.key],
                        )
                      }
                      aria-pressed={on}
                    >
                      {field.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Direction</span>
              <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="ONE_WAY">One way</option>
                <option value="TWO_WAY">Both ways</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">How often</span>
              <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">If they disagree</span>
            <select className="input" value={conflictPolicy} onChange={(e) => setConflictPolicy(e.target.value)}>
              <option value="ASK">Ask me</option>
              <option value="PREFER_SOURCE">Always prefer {sourceConn?.displayName}</option>
              <option value="PREFER_TARGET">Always prefer {targetConn?.displayName}</option>
            </select>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <button
              type="button"
              className="switch mt-0.5"
              data-on={propagateDeletes}
              onClick={() => setPropagateDeletes((v) => !v)}
              aria-label="Propagate deletions"
            />
            <span>
              <span className="text-[14px] font-medium">Let deletions travel</span>
              <span className="block text-[12.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                When a field is cleared at the source, clear it at the destination too.
                Off by default.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-7 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={busy || selected.length === 0}
          >
            {busy ? "Creating…" : "Create sync"}
          </button>
        </div>
      </div>
    </div>
  );
}
