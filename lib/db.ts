import { PrismaClient } from "@prisma/client";

/**
 * Connection strings copied out of a hosting dashboard are almost never in the
 * shape Prisma needs, and the mismatch does not fail at boot — it fails on the
 * first real query, which is a terrible place to find out.
 *
 * Supabase's transaction pooler (port 6543) is the common case: pooled
 * connections are handed out per statement, so Prisma's prepared statements
 * collide unless the URL says pgbouncer=true. Rather than requiring that to be
 * remembered, the URL is corrected here.
 */
function normaliseDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Not parseable: leave it alone and let Prisma report it properly.
    return raw;
  }

  // Transaction mode only. Supabase's session pooler is also on
  // pooler.supabase.com but holds a connection for the whole session, so
  // prepared statements work there and the flag would only cost performance.
  const isTransactionPooler = url.port === "6543" || url.hostname.includes("pgbouncer");

  if (!isTransactionPooler) return raw;

  const adjusted: string[] = [];

  if (!url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
    adjusted.push("pgbouncer=true");
  }
  // A pooled connection should not also be pooled by Prisma; one connection per
  // serverless invocation is what the pooler expects.
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "1");
    adjusted.push("connection_limit=1");
  }

  if (adjusted.length) {
    console.info(
      `[db] transaction pooler detected; added ${adjusted.join(" and ")} to DATABASE_URL`,
    );
  }

  return url.toString();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const datasourceUrl = normaliseDatabaseUrl(process.env.DATABASE_URL);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Exported for testing the URL handling without a live database. */
export const __normaliseDatabaseUrl = normaliseDatabaseUrl;
