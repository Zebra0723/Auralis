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
  console.error("[auth] infrastructure failure", error);

  if (/ENOTFOUND|ECONNREFUSED|Can't reach database|P1001|P1000|P1017/i.test(message)) {
    return "Auralis cannot reach its database right now. This is a problem on our side, not yours. Please try again shortly.";
  }
  if (/does not exist in the current database|P2021|P2022/i.test(message)) {
    return "Auralis is not finished setting up. Database migrations have not been run on this deployment yet.";
  }
  return "Something went wrong on our side. Please try again shortly.";
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
