"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate, createSession, destroySession, registerUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type AuthFormState = { error?: string } | undefined;

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().email("Enter a valid email address."),
  // Length is the property that actually matters; composition rules mostly
  // push people towards predictable substitutions.
  password: z.string().min(10, "Use at least 10 characters."),
});

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  let result: Awaited<ReturnType<typeof authenticate>>;
  try {
    result = await authenticate(parsed.data.email, parsed.data.password);
  } catch (error) {
    return { error: describeInfrastructureFailure(error) };
  }
  if (!result.ok) return { error: result.error };

  await createSession(result.userId);
  redirect("/dashboard");
}

/**
 * A misconfigured or unreachable database is an operator problem, not something
 * the visitor did wrong. Without this they get Next's raw "Application error"
 * page, which tells them nothing and looks broken.
 */
function describeInfrastructureFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  // Log the code separately: it is the one piece an operator actually needs,
  // and it is easy to lose inside a long stack trace in a hosting dashboard.
  console.error(`[auth] infrastructure failure code=${code || "none"}`, error);

  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|Can't reach database|P1001|P1000|P1017/i.test(message)) {
    return "Auralis cannot reach its database. Check DATABASE_URL on this deployment.";
  }
  if (/does not exist in the current database|P2021|P2022/i.test(message) || code === "P2021") {
    return "Auralis is not finished setting up. The database has no tables yet — run the setup SQL.";
  }
  // Prisma against a transaction pooler (Supabase port 6543, PgBouncer)
  // re-uses prepared statement names across pooled connections unless the
  // connection string says pgbouncer=true. It fails only once a real query
  // runs, which is why it shows up at sign-up rather than at boot.
  if (/prepared statement|42P05|26000|ConnectorError/i.test(message) || code === "42P05") {
    return "Auralis cannot use this database connection. Add ?pgbouncer=true&connection_limit=1 to DATABASE_URL, or use the session pooler on port 5432.";
  }
  if (/P2024|Timed out fetching a new connection|too many clients/i.test(message) || code === "P2024") {
    return "The database is not accepting more connections right now. Please try again in a moment.";
  }
  if (/P1010|permission denied|password authentication failed|28P01/i.test(message)) {
    return "Auralis was refused by the database. Check the username and password in DATABASE_URL.";
  }
  // Supabase's copy button yields a template containing [YOUR-PASSWORD]. Pasting
  // it unchanged is the most common setup mistake there is.
  if (/\[YOUR-PASSWORD\]|invalid port number|must start with the protocol/i.test(message)) {
    return "DATABASE_URL is not a valid connection string. If it still contains [YOUR-PASSWORD], replace that with the real password; if the password contains @ : / ? # or %, each must be percent-encoded.";
  }
  if (/P1013|the provided database string is invalid/i.test(message) || code === "P1013") {
    return "DATABASE_URL could not be parsed. Check it for a missing password or unescaped special characters.";
  }

  // Anything unrecognised still names the code, so it can be acted on rather
  // than guessed at.
  return code
    ? `Something went wrong on our side (${code}). Please try again shortly.`
    : "Something went wrong on our side. Please try again shortly.";
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  let result: Awaited<ReturnType<typeof registerUser>>;
  try {
    result = await registerUser(parsed.data);
    if (!result.ok) return { error: result.error };

    await db.auditLog.create({
      data: {
        orgId: result.orgId,
        userId: result.userId,
        action: "workspace.created",
        metadata: {},
      },
    });
  } catch (error) {
    return { error: describeInfrastructureFailure(error) };
  }

  await createSession(result.userId);
  redirect("/dashboard");
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}
