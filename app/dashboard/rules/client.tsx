"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmDialog, EmptyState, relativeTime, useToast } from "@/components/ui";
import { PageHeader } from "../components";

interface ConnectionFields {
  id: string;
  displayName: string;
  readable: { key: string; label: string }[];
  writable: { key: string; label: string }[];
}

interface RuleRow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { connectionId: string; field: string; recordType: string };
  conditions: { field: string; operator: string; value?: string }[];
  actions: { connectionId: string; field: string; value: string }[];
  fireCount: number;
  lastFiredAt: string | null;
}

const OPERATOR_LABEL: Record<string, string> = {
  equals: "is exactly",
  not_equals: "is not",
  contains: "contains",
  starts_with: "starts with",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

export function RulesClient({
  rules,
  connections,
  fieldLabels,
  advancedRules,
  planName,
}: {
  rules: RuleRow[];
  connections: ConnectionFields[];
  fieldLabels: Record<string, string>;
  advancedRules: boolean;
  planName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [building, setBuilding] = useState(false);
  const [deleting, setDeleting] = useState<RuleRow | null>(null);
  const [busy, setBusy] = useState(false);

  const nameFor = (id: string) =>
    connections.find((c) => c.id === id)?.displayName ?? "a disconnected service";

  async function toggle(rule: RuleRow) {
    const res = await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (res.ok) {
      toast(rule.enabled ? `${rule.name} paused.` : `${rule.name} active.`, "success");
      router.refresh();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res = await fetch(`/api/rules/${deleting.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      toast(`${deleting.name} removed.`, "success");
      setDeleting(null);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 lg:px-8 py-7 lg:py-10">
      <PageHeader
        title="Rules"
        subtitle="When something changes in one service, do something in another."
        action={
          connections.length >= 2 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setBuilding(true)}>
              New rule
            </button>
          )
        }
      />

      <div className="mt-8">
        {connections.length < 2 ? (
          <EmptyState
            title="Connect two services first"
            body="A rule watches for a change in one service and acts on another, so you need at least two connected."
            action={<Link href="/dashboard/connections" className="btn btn-primary btn-sm">Go to connections</Link>}
          />
        ) : rules.length === 0 ? (
          <EmptyState
            title="No rules yet"
            body="Syncs keep fields identical. Rules are for everything else — reacting to one change with a different action somewhere else."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setBuilding(true)}>
                Create your first rule
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((rule) => (
              <div key={rule.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-medium">{rule.name}</span>
                      {!rule.enabled && <span className="badge badge-neutral">Paused</span>}
                    </div>

                    {/* The stored rule read back as a sentence. */}
                    <div className="mt-2.5 text-[13.5px] leading-[1.7]" style={{ color: "var(--ink-soft)" }}>
                      <span className="eyebrow mr-2">When</span>
                      {fieldLabels[rule.trigger.field] ?? rule.trigger.field} changes in{" "}
                      {rule.trigger.connectionId === "any" ? "any service" : nameFor(rule.trigger.connectionId)}
                      {rule.conditions.map((condition, i) => (
                        <span key={i}>
                          {" "}and {fieldLabels[condition.field] ?? condition.field}{" "}
                          {OPERATOR_LABEL[condition.operator] ?? condition.operator}
                          {condition.value ? ` "${condition.value}"` : ""}
                        </span>
                      ))}
                      <br />
                      <span className="eyebrow mr-2" style={{ color: "var(--accent)" }}>Then</span>
                      {rule.actions.map((action, i) => (
                        <span key={i}>
                          {i > 0 && ", and "}
                          set {fieldLabels[action.field] ?? action.field} in {nameFor(action.connectionId)} to{" "}
                          {action.value === "{{value}}" ? "the new value" : `"${action.value}"`}
                        </span>
                      ))}
                    </div>

                    <div className="mt-2.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
                      {rule.fireCount === 0
                        ? "Has not run yet"
                        : `Ran ${rule.fireCount} time${rule.fireCount === 1 ? "" : "s"}`}
                      {rule.lastFiredAt && ` · last ${relativeTime(rule.lastFiredAt)}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="switch"
                      data-on={rule.enabled}
                      onClick={() => toggle(rule)}
                      aria-label={rule.enabled ? `Pause ${rule.name}` : `Enable ${rule.name}`}
                    />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(rule)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {building && (
        <RuleBuilder
          connections={connections}
          advancedRules={advancedRules}
          planName={planName}
          onClose={() => setBuilding(false)}
          onCreated={() => {
            setBuilding(false);
            toast("Rule created.", "success");
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Remove ${deleting?.name ?? ""}?`}
        destructive
        busy={busy}
        confirmLabel="Remove rule"
        body="This rule will stop running. Anything it has already done stays as it is."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function RuleBuilder({
  connections,
  advancedRules,
  planName,
  onClose,
  onCreated,
}: {
  connections: ConnectionFields[];
  advancedRules: boolean;
  planName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [triggerConnection, setTriggerConnection] = useState(connections[0]?.id ?? "");
  const [triggerField, setTriggerField] = useState("");
  const [conditions, setConditions] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [actionConnection, setActionConnection] = useState(connections[1]?.id ?? "");
  const [actionField, setActionField] = useState("");
  const [actionValue, setActionValue] = useState("{{value}}");
  const [busy, setBusy] = useState(false);

  const triggerFields = connections.find((c) => c.id === triggerConnection)?.readable ?? [];
  const actionFields = connections.find((c) => c.id === actionConnection)?.writable ?? [];

  async function submit() {
    if (!triggerField || !actionField) {
      toast("Choose both a trigger field and an action field.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || `Rule for ${triggerField}`,
          trigger: { connectionId: triggerConnection, recordType: "profile", field: triggerField },
          conditions: conditions.filter((c) => c.field),
          actions: [{ type: "set_field", connectionId: actionConnection, field: actionField, value: actionValue }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "That rule could not be created.", "error");
        return;
      }
      onCreated();
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
        className="card w-full max-w-[520px] p-6 my-auto"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create a rule"
      >
        <h2 className="title text-[18px]">New rule</h2>

        <label className="flex flex-col gap-1.5 mt-5">
          <span className="eyebrow">Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Keep my title consistent"
          />
        </label>

        {/* WHEN */}
        <div
          className="mt-5 rounded-[8px] p-4"
          style={{ background: "var(--raised)" }}
        >
          <span className="eyebrow">When</span>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <select
              className="input"
              value={triggerConnection}
              onChange={(e) => {
                setTriggerConnection(e.target.value);
                setTriggerField("");
              }}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
            <select className="input" value={triggerField} onChange={(e) => setTriggerField(e.target.value)}>
              <option value="">Choose a field…</option>
              {triggerFields.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
            changes
          </p>
        </div>

        {/* AND (conditions) */}
        <div className="mt-2.5 rounded-[8px] p-4" style={{ background: "var(--raised)" }}>
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">And, optionally</span>
            {advancedRules ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConditions((c) => [...c, { field: "", operator: "equals", value: "" }])}
              >
                Add condition
              </button>
            ) : (
              <span className="badge badge-neutral">Plus feature</span>
            )}
          </div>

          {!advancedRules && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
              Conditions are part of Plus. Your {planName} plan runs rules on the trigger alone.
            </p>
          )}

          {conditions.map((condition, index) => (
            <div key={index} className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <select
                className="input"
                value={condition.field}
                onChange={(e) =>
                  setConditions((c) => c.map((x, i) => (i === index ? { ...x, field: e.target.value } : x)))
                }
              >
                <option value="">Field…</option>
                {triggerFields.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
              <select
                className="input"
                value={condition.operator}
                onChange={(e) =>
                  setConditions((c) => c.map((x, i) => (i === index ? { ...x, operator: e.target.value } : x)))
                }
              >
                {Object.entries(OPERATOR_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                className="input"
                value={condition.value}
                placeholder="Value"
                disabled={condition.operator === "is_empty" || condition.operator === "is_not_empty"}
                onChange={(e) =>
                  setConditions((c) => c.map((x, i) => (i === index ? { ...x, value: e.target.value } : x)))
                }
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConditions((c) => c.filter((_, i) => i !== index))}
                aria-label="Remove condition"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* THEN */}
        <div
          className="mt-2.5 rounded-[8px] p-4"
          style={{ background: "var(--accent-soft)" }}
        >
          <span className="eyebrow" style={{ color: "var(--accent)" }}>Then set</span>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <select
              className="input"
              value={actionConnection}
              onChange={(e) => {
                setActionConnection(e.target.value);
                setActionField("");
              }}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
            <select className="input" value={actionField} onChange={(e) => setActionField(e.target.value)}>
              <option value="">Choose a field…</option>
              {actionFields.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>

          {actionFields.length === 0 && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--amber)" }}>
              That service is read-only, so a rule cannot write to it. Choose another.
            </p>
          )}

          <div className="mt-2.5">
            <select
              className="input"
              value={actionValue === "{{value}}" ? "{{value}}" : "literal"}
              onChange={(e) => setActionValue(e.target.value === "{{value}}" ? "{{value}}" : "")}
            >
              <option value="{{value}}">to the new value</option>
              <option value="literal">to a fixed value…</option>
            </select>
            {actionValue !== "{{value}}" && (
              <input
                className="input mt-2"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                placeholder="The value to set"
              />
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={busy || !triggerField || !actionField}
          >
            {busy ? "Creating…" : "Create rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
