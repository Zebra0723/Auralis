"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ConfirmDialog,
  ProviderMark,
  relativeTime,
  useToast,
} from "@/components/ui";
import { PageHeader } from "../components";

export interface CatalogueEntry {
  key: string;
  name: string;
  category: string;
  blurb: string;
  authMethod: string;
  accent: string;
  mark: string;
  setupUrl: string | null;
  setupHint: string | null;
  status: string;
  connectable: boolean;
  unavailableReason: string | null;
  missingEnv: string[];
  writableFieldCount: number;
  readableFieldCount: number;
}

export interface ConnectionRow {
  id: string;
  provider: string;
  displayName: string;
  accountLabel: string | null;
  status: string;
  statusDetail: string | null;
  scopes: string[];
  lastSyncedAt: string | null;
}

export function ConnectionsClient({
  connections,
  catalogue,
  plan,
  flash,
}: {
  connections: ConnectionRow[];
  catalogue: CatalogueEntry[];
  plan: { name: string; maxConnections: number };
  flash: { error: string | null; connected: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [tokenFor, setTokenFor] = useState<CatalogueEntry | null>(null);
  const [disconnecting, setDisconnecting] = useState<ConnectionRow | null>(null);
  const [busy, setBusy] = useState(false);

  // The OAuth callback communicates its outcome through the URL; surface it once
  // and then clean the address bar so a refresh does not repeat the message.
  useEffect(() => {
    if (flash.connected) toast(`${flash.connected} connected.`, "success");
    if (flash.error) toast(flash.error, "error");
    if (flash.connected || flash.error) {
      router.replace("/dashboard/connections");
    }
  }, [flash.connected, flash.error, toast, router]);

  const connectedKeys = new Map(connections.map((c) => [c.provider, c]));
  const atLimit =
    plan.maxConnections !== -1 && connections.length >= plan.maxConnections;

  function startConnect(entry: CatalogueEntry) {
    if (atLimit) {
      toast(
        `Your ${plan.name} plan includes ${plan.maxConnections} connections. Upgrade to connect more.`,
        "error",
      );
      return;
    }
    if (entry.authMethod === "oauth2") {
      window.location.href = `/api/oauth/${entry.key}/start`;
      return;
    }
    if (entry.authMethod === "internal") {
      // The Vault already belongs to this workspace; there is nothing to authorise.
      void connectInternal(entry);
      return;
    }
    setTokenFor(entry);
  }

  async function connectInternal(entry: CatalogueEntry) {
    setBusy(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: entry.key, token: "internal" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "That connection could not be completed.", "error");
        return;
      }
      toast(`${entry.name} is ready.`, "success");
      router.refresh();
    } catch {
      toast("We could not reach Auralis. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitToken(token: string) {
    if (!tokenFor) return;
    setBusy(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: tokenFor.key, token }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "That connection could not be completed.", "error");
        return;
      }
      toast(`${tokenFor.name} connected.`, "success");
      setTokenFor(null);
      router.refresh();
    } catch {
      toast("We could not reach Auralis. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisconnect() {
    if (!disconnecting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/connections/${disconnecting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "That connection could not be removed.", "error");
        return;
      }
      toast(`${disconnecting.displayName} disconnected.`, "success");
      setDisconnecting(null);
      router.refresh();
    } catch {
      toast("We could not reach Auralis. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  const available = catalogue.filter((c) => !connectedKeys.has(c.key));

  return (
    <div className="mx-auto max-w-[980px] px-5 lg:px-8 py-7 lg:py-10">
      <PageHeader
        title="Connections"
        subtitle={
          plan.maxConnections === -1
            ? `${connections.length} connected.`
            : `${connections.length} of ${plan.maxConnections} connected on ${plan.name}.`
        }
      />

      {connections.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">Connected</h2>
          <div className="flex flex-col gap-2">
            {connections.map((connection) => {
              const entry = catalogue.find((c) => c.key === connection.provider);
              return (
                <div key={connection.id} className="card p-4 flex flex-wrap items-center gap-3">
                  {entry && <ProviderMark mark={entry.mark} accent={entry.accent} />}
                  <div className="min-w-[160px] flex-1">
                    <div className="text-[14.5px] font-medium">{connection.displayName}</div>
                    <div className="text-[12.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                      {connection.accountLabel ?? "Connected"}
                      {connection.lastSyncedAt &&
                        ` · synced ${relativeTime(connection.lastSyncedAt)}`}
                    </div>
                    {connection.status !== "ACTIVE" && connection.statusDetail && (
                      <div className="text-[12.5px] mt-1.5" style={{ color: "var(--amber)" }}>
                        {connection.statusDetail}
                      </div>
                    )}
                  </div>
                  <span
                    className={`badge ${
                      connection.status === "ACTIVE" ? "badge-signal"
                      : connection.status === "NEEDS_REAUTH" ? "badge-amber"
                      : "badge-danger"
                    }`}
                  >
                    {connection.status === "ACTIVE" ? "Active"
                      : connection.status === "NEEDS_REAUTH" ? "Needs reconnecting"
                      : "Error"}
                  </span>
                  <div className="flex gap-2">
                    {connection.status !== "ACTIVE" && entry && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => startConnect(entry)}
                      >
                        Reconnect
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDisconnecting(connection)}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-9">
        <h2 className="eyebrow mb-3">Available services</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {available.map((entry) => (
            <div key={entry.key} className="card card-pad flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProviderMark mark={entry.mark} accent={entry.accent} />
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-medium truncate">{entry.name}</div>
                    <div className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
                      {entry.category}
                    </div>
                  </div>
                </div>
                {entry.connectable ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => startConnect(entry)}
                  >
                    Connect
                  </button>
                ) : entry.unavailableReason === "planned" ? (
                  <span className="badge badge-neutral">Coming soon</span>
                ) : (
                  <span className="badge badge-amber">Needs setup</span>
                )}
              </div>

              <p className="text-[13px] leading-[1.5]" style={{ color: "var(--ink-soft)" }}>
                {entry.blurb}
              </p>

              {entry.connectable && (
                <p className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
                  Reads {entry.readableFieldCount} fields
                  {entry.writableFieldCount > 0
                    ? `, writes ${entry.writableFieldCount}`
                    : " · read-only"}
                </p>
              )}

              {/* Honest about why something cannot be connected, and what fixes it. */}
              {!entry.connectable && entry.unavailableReason === "not_configured" && (
                <div
                  className="text-[12px] rounded-[6px] px-3 py-2.5"
                  style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
                >
                  <div className="font-medium">Requires API configuration</div>
                  <div className="mt-1" style={{ opacity: 0.9 }}>
                    An administrator needs to set{" "}
                    <code className="font-mono">{entry.missingEnv.join(", ")}</code>.
                    {entry.setupHint && ` ${entry.setupHint}`}
                  </div>
                  {entry.setupUrl && (
                    <a
                      href={entry.setupUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="link-underline inline-block mt-1.5"
                      style={{ color: "inherit" }}
                    >
                      Where to get these
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {tokenFor && (
        <TokenDialog
          entry={tokenFor}
          busy={busy}
          onCancel={() => setTokenFor(null)}
          onSubmit={submitToken}
        />
      )}

      <ConfirmDialog
        open={Boolean(disconnecting)}
        title={`Disconnect ${disconnecting?.displayName ?? ""}?`}
        destructive
        busy={busy}
        confirmLabel="Disconnect"
        body={
          <>
            Auralis will revoke its access where the service allows it and delete the
            stored credentials. Any syncs using this connection will be removed. Nothing
            already written to your other services is changed.
          </>
        }
        onConfirm={confirmDisconnect}
        onCancel={() => setDisconnecting(null)}
      />
    </div>
  );
}

function TokenDialog({
  entry,
  busy,
  onCancel,
  onSubmit,
}: {
  entry: CatalogueEntry;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (token: string) => void;
}) {
  const [token, setToken] = useState("");

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-5 fade"
      style={{ background: "rgba(10, 12, 11, 0.45)" }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="card w-full max-w-[440px] p-6"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Connect ${entry.name}`}
      >
        <div className="flex items-center gap-3">
          <ProviderMark mark={entry.mark} accent={entry.accent} />
          <h2 className="title text-[17px]">Connect {entry.name}</h2>
        </div>

        <p className="mt-4 text-[13.5px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
          {entry.setupHint ??
            `Paste an access token for ${entry.name}. Auralis stores it encrypted and never sees your password.`}
        </p>

        {entry.setupUrl && (
          <a
            href={entry.setupUrl}
            target="_blank"
            rel="noreferrer"
            className="link-underline text-[13px] inline-block mt-2"
            style={{ color: "var(--signal)" }}
          >
            Create a token on {entry.name}
          </a>
        )}

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (token.trim()) onSubmit(token.trim());
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Access token</span>
            <input
              className="input font-mono text-[13px]"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your token"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !token.trim()}>
              {busy ? "Verifying…" : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
