"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AuralisWordmark } from "@/components/logo";
import { signOutAction } from "../(auth)/actions";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badgeKey?: "conflicts" | "connections";
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: <IconGrid /> },
  { href: "/dashboard/connections", label: "Connections", icon: <IconPlug />, badgeKey: "connections" },
  { href: "/dashboard/syncs", label: "Syncs", icon: <IconSync />, badgeKey: "conflicts" },
  { href: "/dashboard/activity", label: "Activity", icon: <IconPulse /> },
  { href: "/dashboard/rules", label: "Rules", icon: <IconBranch /> },
  { href: "/dashboard/settings", label: "Settings", icon: <IconSliders /> },
];

/**
 * The dashboard shell.
 *
 * Desktop gets a persistent sidebar. Mobile gets a fixed bottom bar with the
 * five destinations reachable by thumb — not the sidebar shrunk down, which is
 * how most dashboards end up unusable on a phone.
 */
export function DashboardChrome({
  user,
  badges,
  children,
}: {
  user: { name: string | null; email: string; orgName: string };
  badges: { conflicts: number; connections: number };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside
        className="hidden lg:flex flex-col w-[228px] shrink-0 border-r sticky top-0 h-screen"
        style={{ borderColor: "var(--line-soft)", background: "var(--surface)" }}
      >
        <div className="h-16 flex items-center px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
            <AuralisWordmark size={15.5} markSize={20} />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
          {NAV.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              badge={item.badgeKey ? badges[item.badgeKey] : 0}
            />
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: "var(--line-soft)" }}>
          <div className="px-2 py-2">
            <div className="text-[13px] font-medium truncate">{user.name ?? user.email}</div>
            <div className="text-[11.5px] truncate" style={{ color: "var(--ink-faint)" }}>
              {user.orgName}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <form action={signOutAction} className="flex-1">
              <button type="submit" className="btn btn-ghost btn-sm w-full justify-start">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile) */}
        <header
          className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b"
          style={{
            borderColor: "var(--line-soft)",
            background: "color-mix(in srgb, var(--paper) 88%, transparent)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Link href="/dashboard" className="flex items-center gap-2 no-underline">
            <AuralisWordmark size={15.5} markSize={20} />
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Account menu"
              style={{ width: 32, padding: 0 }}
            >
              <IconDots />
            </button>
          </div>
        </header>

        {menuOpen && (
          <div
            className="lg:hidden card mx-4 mt-2 p-3 fade"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="px-1 pb-2">
              <div className="text-[13px] font-medium truncate">{user.name ?? user.email}</div>
              <div className="text-[11.5px] truncate" style={{ color: "var(--ink-faint)" }}>
                {user.orgName}
              </div>
            </div>
            <form action={signOutAction}>
              <button type="submit" className="btn btn-secondary btn-sm w-full">Sign out</button>
            </form>
          </div>
        )}

        <main className="flex-1 pb-24 lg:pb-0">{children}</main>
      </div>

      {/* Bottom bar (mobile) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex"
        style={{
          borderColor: "var(--line)",
          background: "color-mix(in srgb, var(--surface) 94%, transparent)",
          backdropFilter: "blur(12px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {NAV.slice(0, 5).map((item) => {
          const active = isActive(item.href);
          const badge = item.badgeKey ? badges[item.badgeKey] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 no-underline relative"
              style={{ color: active ? "var(--accent)" : "var(--ink-faint)" }}
              aria-current={active ? "page" : undefined}
            >
              {item.icon}
              <span className="text-[10.5px] font-medium">{item.label}</span>
              {badge > 0 && (
                <span
                  className="absolute top-1.5 right-[calc(50%-18px)] w-[7px] h-[7px] rounded-full"
                  style={{ background: "var(--amber)" }}
                  aria-label={`${badge} needing attention`}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
}) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 px-3 h-9 rounded-[7px] text-[13.5px] no-underline transition-colors duration-150"
      style={{
        background: active ? "var(--raised)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-soft)",
        fontWeight: active ? 500 : 400,
      }}
      aria-current={active ? "page" : undefined}
    >
      <span style={{ color: active ? "var(--accent)" : "var(--ink-faint)" }}>{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {badge > 0 && (
        <span
          className="text-[10.5px] font-medium px-1.5 h-[18px] rounded-full flex items-center"
          style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

/* icons kept inline: six small glyphs do not justify an icon dependency */

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconPlug() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8zM12 17v5" />
    </svg>
  );
}
function IconSync() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2" /><path d="M21 4v5h-5M3 20v-5h5" />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}
function IconBranch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" /><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="12" r="2.5" />
      <path d="M6 7.5v9M8.5 19h4a3 3 0 0 0 3-3v-2M8.5 5h4a3 3 0 0 1 3 3v2" />
    </svg>
  );
}
function IconSliders() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="16" cy="18" r="2" />
    </svg>
  );
}
function IconDots() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
