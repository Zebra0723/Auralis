"use client";

import { hasServiceLogo, ServiceLogo } from "@/components/service-logos";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ toast */

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    // Errors stay longer: they usually contain something the user must act on.
    const ttl = tone === "error" ? 7000 : 4000;
    setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), ttl);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="fixed z-[100] flex flex-col gap-2 pointer-events-none"
        style={{ bottom: 20, right: 20, left: 20, alignItems: "flex-end" }}
        aria-live="polite"
        role="status"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="card pointer-events-auto max-w-[380px] px-4 py-3 text-[13.5px] flex items-start gap-2.5"
            style={{
              boxShadow: "var(--shadow-pop)",
              animation: "a-toast-in 0.3s var(--ease-out-quint) both",
              borderColor:
                toast.tone === "error" ? "var(--danger)"
                : toast.tone === "success" ? "var(--accent)"
                : "var(--line)",
            }}
          >
            <span
              className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background:
                  toast.tone === "error" ? "var(--danger)"
                  : toast.tone === "success" ? "var(--accent)"
                  : "var(--ink-faint)",
              }}
            />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ----------------------------------------------------------------- dialog */

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    // Prevent the page behind the dialog from scrolling under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-5 fade"
      style={{ background: "rgba(10, 12, 11, 0.45)" }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="card w-full max-w-[420px] p-6"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="title text-[17px]">{title}</h2>
        <div className="mt-2.5 text-[14px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
          {body}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-sm ${destructive ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ empty state */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center text-center px-6 py-14">
      {icon && <div className="mb-4" style={{ color: "var(--ink-faint)" }}>{icon}</div>}
      <h3 className="title text-[16px]">{title}</h3>
      <p className="mt-2 text-[14px] max-w-[42ch]" style={{ color: "var(--ink-soft)" }}>
        {body}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 p-4">
          <div className="skeleton w-8 h-8 rounded-[7px]" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- utilities */

export function relativeTime(date: string | Date): string {
  const then = new Date(date).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ProviderMark({
  mark,
  accent,
  size = 32,
  providerKey,
}: {
  mark: string;
  accent: string;
  size?: number;
  providerKey?: string;
}) {
  const hasLogo = providerKey ? hasServiceLogo(providerKey) : false;

  return (
    <span
      className="rounded-[7px] flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        // A real logo sits on a neutral chip; tinting it with the provider's
        // own colour would fight the logo's own palette.
        background: hasLogo ? "var(--raised)" : `${accent}14`,
        color: accent,
        fontSize: size * 0.38,
      }}
      aria-hidden="true"
    >
      {hasLogo && providerKey ? (
        <ServiceLogo providerKey={providerKey} size={Math.round(size * 0.6)} />
      ) : (
        mark
      )}
    </span>
  );
}
