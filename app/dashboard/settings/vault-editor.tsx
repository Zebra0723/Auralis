"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";

interface FieldSpec {
  key: string;
  label: string;
  type: string;
}

/**
 * Editing the canonical record is the "change it once" moment, so the save
 * only sends fields the user actually touched. Sending the whole record would
 * mark untouched fields as changed and trigger pointless writes to every
 * connected service.
 */
export function VaultEditor({
  initial,
  fields,
}: {
  initial: Record<string, string | null>;
  fields: FieldSpec[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? ""])),
  );
  const [busy, setBusy] = useState(false);

  const dirty = fields.filter((f) => (initial[f.key] ?? "") !== values[f.key]);

  async function save() {
    if (dirty.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/vault", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: Object.fromEntries(dirty.map((f) => [f.key, values[f.key]])),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Those changes could not be saved.", "error");
        return;
      }
      toast(
        dirty.length === 1
          ? `${dirty[0].label} saved and queued for your connected services.`
          : `${dirty.length} fields saved and queued for your connected services.`,
        "success",
      );
      router.refresh();
    } catch {
      toast("We could not reach Auralis. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--ink-soft)" }}>
              {field.label}
            </span>
            {field.type === "text" ? (
              <textarea
                className="input"
                rows={2}
                value={values[field.key]}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            ) : (
              <input
                className="input"
                type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
                value={values[field.key]}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || dirty.length === 0}>
          {busy ? "Saving…" : "Save and propagate"}
        </button>
        {dirty.length > 0 && (
          <span className="text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
            {dirty.length} unsaved change{dirty.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
