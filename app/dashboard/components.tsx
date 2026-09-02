import type { ReactNode } from "react";
import type { SyncEvent } from "@prisma/client";
import { relativeTime } from "@/components/ui";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="title text-[24px] lg:text-[27px]">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-[14px]" style={{ color: "var(--ink-soft)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="eyebrow">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "signal" | "amber";
}) {
  return (
    <div className="card p-4">
      <div className="text-[11.5px] font-medium" style={{ color: "var(--ink-faint)" }}>
        {label}
      </div>
      <div
        className="display mt-2 text-[28px] tabular-nums"
        style={{
          color:
            tone === "amber" ? "var(--amber)"
            : tone === "signal" ? "var(--accent)"
            : "var(--ink)",
        }}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const LEVEL_STYLE: Record<string, { dot: string; label: string }> = {
  SUCCESS: { dot: "var(--accent)", label: "Synced" },
  INFO: { dot: "var(--ink-faint)", label: "Info" },
  WARNING: { dot: "var(--amber)", label: "Warning" },
  ERROR: { dot: "var(--danger)", label: "Failed" },
  CONFLICT: { dot: "var(--amber)", label: "Conflict" },
};

export function EventRow({ event }: { event: SyncEvent }) {
  const style = LEVEL_STYLE[event.level] ?? LEVEL_STYLE.INFO;
  return (
    <div className="flex items-start gap-3 p-4">
      <span
        className="w-[7px] h-[7px] rounded-full shrink-0 mt-[7px]"
        style={{ background: style.dot }}
        aria-label={style.label}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">{event.title}</div>
        {event.detail && (
          <div className="text-[13px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
            {event.detail}
          </div>
        )}
        {(event.sourceLabel || event.targetLabel) && (
          <div className="text-[12.5px] mt-1 flex items-center gap-1.5" style={{ color: "var(--ink-faint)" }}>
            <span>{event.sourceLabel}</span>
            {event.sourceLabel && event.targetLabel && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span>{event.targetLabel}</span>
          </div>
        )}
      </div>
      <time
        className="text-[12px] shrink-0 whitespace-nowrap"
        style={{ color: "var(--ink-faint)" }}
        dateTime={new Date(event.createdAt).toISOString()}
      >
        {relativeTime(event.createdAt)}
      </time>
    </div>
  );
}
