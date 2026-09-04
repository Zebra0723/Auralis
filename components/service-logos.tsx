/**
 * Service marks, drawn as SVG.
 *
 * Simplified but recognisable renderings in each service's own brand colours,
 * used nominatively to identify the integration. Anything without a mark here
 * falls back to the lettered chip, so adding a provider never leaves a hole.
 */

import type { ReactNode } from "react";

const LOGOS: Record<string, (size: number) => ReactNode> = {
  google: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.87z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.27a12 12 0 0 0 0 10.74l4-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  ),

  microsoft: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  ),

  // Four rounded bars in a pinwheel, in Slack's four brand colours.
  slack: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="9.4" width="8.6" height="3.2" rx="1.6" fill="#36C5F0" />
      <rect x="11.4" y="2" width="3.2" height="8.6" rx="1.6" fill="#2EB67D" />
      <rect x="13.4" y="11.4" width="8.6" height="3.2" rx="1.6" fill="#ECB22E" />
      <rect x="9.4" y="13.4" width="3.2" height="8.6" rx="1.6" fill="#E01E5A" />
    </svg>
  ),

  github: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#181717"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </svg>
  ),

  // Dropbox is four parallelograms forming a stacked box.
  dropbox: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#0061FF" d="M6 2 0 6l6 4 6-4zM18 2l-6 4 6 4 6-4zM0 14l6 4 6-4-6-4zM18 10l-6 4 6 4 6-4zM6 19.5l6 4 6-4-6-4z" />
    </svg>
  ),

  googledrive: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#0066DA" d="M1.6 17.4 3.4 20.5c.37.65.9 1.16 1.53 1.53l4-6.93H1.06c0 .72.19 1.44.55 2.07z" />
      <path fill="#00AC47" d="M12 8.1 8 1.17c-.63.37-1.16.88-1.53 1.53L.55 13.13A4.1 4.1 0 0 0 0 15.2h8.06L12 8.1z" />
      <path fill="#EA4335" d="M18.93 22.03c.63-.37 1.16-.88 1.53-1.53l.77-1.32 3.68-6.38c.36-.63.55-1.35.55-2.07h-8.07l1.72 3.37-.18 7.93z" />
      <path fill="#00832D" d="M12 8.1 15.95 1.2A4.1 4.1 0 0 0 14.1.83H9.9c-.66 0-1.31.16-1.9.34L12 8.1z" />
      <path fill="#2684FC" d="M15.94 15.2H8.06l-3.13 5.4c.59.19 1.24.35 1.9.35h10.34c.66 0 1.31-.16 1.9-.35l-3.13-5.4z" />
      <path fill="#FFBA00" d="M18.89 8.55 15.8 3.2c-.37-.65-.9-1.16-1.53-1.53L12 8.1l3.94 7.1h8.05c0-.72-.19-1.44-.55-2.07l-4.55-4.58z" />
    </svg>
  ),

  zoom: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5.4" fill="#0B5CFF" />
      <path fill="#fff" d="M5.4 9.1c0-.6.5-1.1 1.1-1.1h6.2c1.1 0 2 .9 2 2v5c0 .6-.5 1-1.1 1H7.4c-1.1 0-2-.9-2-2V9.1zm10.5 2.2 2.8-2c.4-.3 1 0 1 .5v4.5c0 .5-.6.8-1 .5l-2.8-2v-1.5z" />
    </svg>
  ),

  trello: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="4.2" fill="#0052CC" />
      <rect x="4" y="4.6" width="6.4" height="14.8" rx="1.3" fill="#fff" />
      <rect x="13.2" y="4.6" width="6.4" height="8.6" rx="1.3" fill="#fff" />
    </svg>
  ),

  asana: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="6" r="4.3" fill="#F06A6A" />
      <circle cx="5.4" cy="16.6" r="4.3" fill="#F06A6A" />
      <circle cx="18.6" cy="16.6" r="4.3" fill="#F06A6A" />
    </svg>
  ),

  discord: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#5865F2"
        d="M19.3 5.3A16.9 16.9 0 0 0 15.1 4l-.2.4a15.7 15.7 0 0 1 3.7 1.2 12.9 12.9 0 0 0-11.2 0 15.6 15.6 0 0 1 3.7-1.2L10.9 4a16.9 16.9 0 0 0-4.2 1.3C3.6 9.6 2.8 13.9 3.2 18a17 17 0 0 0 5.1 2.6l.7-1.4a11 11 0 0 1-1.7-.8l.4-.3a12.1 12.1 0 0 0 10.6 0l.4.3a11 11 0 0 1-1.7.8l.7 1.4a17 17 0 0 0 5.1-2.6c.5-4.8-.8-9-3.5-12.7zM9.3 15.6c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2c0 1.1-.8 2-1.8 2zm5.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2c0 1.1-.8 2-1.8 2z"
      />
    </svg>
  ),

  notion: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#fff" stroke="#E3E3E1" />
      <path
        fill="#000"
        d="M7 6.6v10.8h2V10l5.2 7.4h2.3V6.6h-2v7.2L9.4 6.6H7z"
      />
    </svg>
  ),

  linkedin: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.6 9.7H4.9v9.4h2.7V9.7zM6.2 8.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM19.2 19.1h-2.7v-4.6c0-1.1-.4-1.9-1.4-1.9-.8 0-1.2.5-1.4 1-.1.2-.1.5-.1.8v4.7H10.9s0-7.6 0-8.4h2.7v1.2c.4-.6 1-1.4 2.5-1.4 1.8 0 3.1 1.2 3.1 3.7v4.9z"
      />
    </svg>
  ),

  hubspot: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FF7A59"
        d="M18 8.6V6.2a1.9 1.9 0 1 0-2 0v2.4a5.4 5.4 0 0 0-2.6 1.1L7 5.3a2.2 2.2 0 1 0-1 1.6l6.2 4.3a5.4 5.4 0 0 0 .1 5.9l-1.9 1.9a1.7 1.7 0 1 0 1.2 1.2l1.9-1.9A5.4 5.4 0 1 0 18 8.6zm-1 8.6a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6z"
      />
    </svg>
  ),

  // Two arcs forming a sync loop with a tick at the centre — DailyOS' own mark.
  dailyos: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="dailyos-mark" x1="3" y1="20" x2="21" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2c5a80" />
          <stop offset="1" stopColor="#5b93bd" />
        </linearGradient>
      </defs>
      {/* Upper arc, sweeping right, with its arrowhead at the end. */}
      <path
        d="M4.4 10.2A8 8 0 0 1 18.6 7.4"
        stroke="url(#dailyos-mark)"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M18.9 3.4v4.2h-4.2" stroke="url(#dailyos-mark)" strokeWidth="2.1"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Lower arc, sweeping back the other way. */}
      <path
        d="M19.6 13.8A8 8 0 0 1 5.4 16.6"
        stroke="url(#dailyos-mark)"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M5.1 20.6v-4.2h4.2" stroke="url(#dailyos-mark)" strokeWidth="2.1"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* The tick, sitting inside the loop. */}
      <path d="M8.6 12.2l2.4 2.4 4.4-5" stroke="url(#dailyos-mark)" strokeWidth="2.1"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),

  vault: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="vault-mark" x1="4" y1="28" x2="28" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-blue)" />
          <stop offset="1" stopColor="var(--brand-purple)" />
        </linearGradient>
      </defs>
      <path
        d="M5 27 L15 6 Q16 4 17 6 L27 27"
        stroke="url(#vault-mark)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
};

export function hasServiceLogo(providerKey: string): boolean {
  return providerKey in LOGOS;
}

export function ServiceLogo({
  providerKey,
  size = 18,
}: {
  providerKey: string;
  size?: number;
}) {
  const render = LOGOS[providerKey];
  return render ? <>{render(size)}</> : null;
}
