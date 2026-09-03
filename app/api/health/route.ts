import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Deployment diagnostics.
 *
 * Sign-up failing on a fresh deployment is nearly always configuration, and
 * hunting for the cause in a hosting dashboard's log viewer is slow. This
 * endpoint answers the question directly: which variables are set, whether the
 * database answers, whether the tables exist.
 *
 * It reports the shape of the configuration and never its content — no
 * connection string, host, username or key value is included, only whether
 * each is present and well formed.
 */

export const dynamic = "force-dynamic";

/** Strip anything that could carry a credential out of a provider's error text. */
function sanitise(message: string): string {
  return message
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, "postgresql://[redacted]")
    .replace(/password=[^\s&"']+/gi, "password=[redacted]")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 400);
}

function describeDatabaseUrl(raw: string | undefined) {
  if (!raw) return { set: false as const, problem: "DATABASE_URL is not set." };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      set: true as const,
      valid: false,
      problem:
        "DATABASE_URL is not a valid URL. If the password contains @ : / ? # or %, each must be percent-encoded.",
    };
  }

  // The single most common mistake: pasting Supabase's template without
  // substituting the password.
  const placeholder = /\[YOUR-PASSWORD\]|\[password\]|YOUR_PASSWORD/i.test(raw);

  // A passwordless connection is normal locally (trust auth, unix sockets) and
  // for IAM auth, so it is only worth flagging against a remote host.
  const remote = !["localhost", "127.0.0.1", "::1", ""].includes(url.hostname);

  return {
    set: true as const,
    valid: true,
    protocol: url.protocol.replace(":", ""),
    port: url.port || "(default)",
    hasPassword: Boolean(url.password),
    passwordLooksLikePlaceholder: placeholder,
    pooled: url.port === "6543",
    pgbouncerParam: url.searchParams.get("pgbouncer"),
    problem: placeholder
      ? "DATABASE_URL still contains the placeholder password. Replace [YOUR-PASSWORD] with the real database password."
      : remote && !url.password
        ? "DATABASE_URL has no password, and the host is remote."
        : url.protocol !== "postgresql:" && url.protocol !== "postgres:"
          ? `DATABASE_URL protocol is "${url.protocol.replace(":", "")}", expected postgresql.`
          : null,
  };
}

export async function GET() {
  const encryptionKey = process.env.AURALIS_ENCRYPTION_KEY;
  let keyBytes = 0;
  try {
    keyBytes = encryptionKey ? Buffer.from(encryptionKey, "base64").length : 0;
  } catch {
    keyBytes = -1;
  }

  const checks = {
    databaseUrl: describeDatabaseUrl(process.env.DATABASE_URL),
    encryptionKey: {
      set: Boolean(encryptionKey),
      bytes: keyBytes,
      problem: !encryptionKey
        ? "AURALIS_ENCRYPTION_KEY is not set. Connections cannot be stored without it."
        : keyBytes !== 32
          ? `AURALIS_ENCRYPTION_KEY decodes to ${keyBytes} bytes, expected exactly 32. Generate one with: openssl rand -base64 32`
          : null,
    },
    appUrl: {
      set: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      problem: process.env.NEXT_PUBLIC_APP_URL
        ? null
        : "NEXT_PUBLIC_APP_URL is not set. OAuth redirects will not match.",
    },
    database: await checkDatabase(),
  };

  const problems = [
    checks.databaseUrl.set === false ? checks.databaseUrl.problem : null,
    "problem" in checks.databaseUrl ? checks.databaseUrl.problem : null,
    checks.encryptionKey.problem,
    checks.appUrl.problem,
    checks.database.problem,
  ].filter(Boolean);

  return NextResponse.json(
    {
      ok: problems.length === 0,
      problems,
      checks,
    },
    { status: problems.length === 0 ? 200 : 503 },
  );
}

async function checkDatabase() {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : null;
    return {
      reachable: false,
      code,
      detail: sanitise(message),
      problem: `The database did not answer${code ? ` (${code})` : ""}. ${sanitise(message)}`,
    };
  }

  // Reachable. Now: does it have the schema?
  try {
    const users = await db.user.count();
    const plans = await db.plan.count();
    return {
      reachable: true,
      tablesPresent: true,
      users,
      plans,
      problem:
        plans === 0
          ? "The tables exist but no plan rows were inserted. Run the seed section of prisma/sql/setup.sql."
          : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : null;
    return {
      reachable: true,
      tablesPresent: false,
      code,
      detail: sanitise(message),
      problem:
        code === "P2021" || /does not exist/i.test(message)
          ? "The database is reachable but has no tables. Run prisma/sql/setup.sql in the SQL editor."
          : `A query failed${code ? ` (${code})` : ""}. ${sanitise(message)}`,
    };
  }
}
