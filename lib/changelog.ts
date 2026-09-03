/**
 * The release history, and the only place a version number is defined.
 *
 * To ship a change: add one entry to the TOP of this array. The version number
 * is derived from the array length, so it cannot drift out of step with what
 * actually shipped — there is no second constant to forget to bump.
 */

export interface Release {
  /** One line, in plain language. This is what people read. */
  summary: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Optional detail, for changes worth explaining. */
  notes?: string[];
}

/** Newest first. */
const RELEASES: Release[] = [
  {
    summary: "Auralis is installable, and the mark matches the real artwork",
    date: "2026-09-03",
    notes: [
      "Install it from the browser like any app. It keeps working offline enough to explain itself, and never shows you stale sync state.",
      "The logo is drawn as SVG, so the app icon, the favicon and the mark in the interface are all the same artwork.",
      "Service marks replace the lettered chips, and the header now credits DailyOS.",
      "A new /api/health page reports why a deployment is misconfigured, without revealing how it is configured.",
    ],
  },
  {
    summary: "Added a version number and this changelog",
    date: "2026-09-03",
    notes: [
      "The version is derived from this list rather than stored separately, so it always matches what shipped.",
      "Shown in the site footer and in Settings, and linked to the full history.",
    ],
  },
  {
    summary: "Adopted the Auralis logo, and fixed sign-up on pooled databases",
    date: "2026-09-03",
    notes: [
      "Sign-up failed against Supabase's transaction pooler, because Prisma re-uses prepared statement names and the pooler hands out a different connection per statement. Auralis now detects a pooled connection and configures itself, rather than expecting the connection string to be hand-edited.",
      "The mark is drawn as SVG so it stays sharp at any size; the palette moved from green to the brand blue.",
    ],
  },
  {
    summary: "Added a one-paste SQL setup script for hosted databases",
    date: "2026-09-03",
    notes: [
      "Creates every table, index and foreign key and inserts the plan rows. Safe to run twice.",
    ],
  },
  {
    summary: "Moved deployment to Vercel's Git integration",
    date: "2026-09-03",
  },
  {
    summary: "Readable errors when the database is unreachable",
    date: "2026-09-02",
    notes: [
      "A deployment without a database answered a submitted form with a raw application error. It now says what is actually wrong.",
    ],
  },
  {
    summary: "Reworked the visual design around one typographic system",
    date: "2026-09-02",
  },
  {
    summary: "Added Settings, the canonical record editor, and deployment docs",
    date: "2026-09-02",
  },
  {
    summary: "First release: connections, syncs, conflicts, rules and activity",
    date: "2026-09-02",
    notes: [
      "Eleven integrations behind one interface, a hub-and-spoke sync engine with per-field conflict detection, and a background job queue with retries.",
    ],
  },
];

export const releases = RELEASES;

/** Increments by one with every entry added above. */
export const VERSION = RELEASES.length;

export const VERSION_LABEL = `v${VERSION}`;

export const latestRelease = RELEASES[0];
