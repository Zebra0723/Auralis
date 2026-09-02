import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth";
import { IntegrationError } from "@/lib/integrations/types";

/**
 * Shared plumbing for the internal API.
 *
 * Every route validates its input server-side and returns errors in one shape,
 * so the client never has to interpret a provider's raw failure and messages
 * stay written for people rather than for logs.
 */

export type ApiError = { error: string; code?: string; details?: unknown };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json<ApiError>({ error: message, code }, { status });
}

export async function requireUser(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getSession();
  if (!user) {
    return { ok: false, response: fail("You need to sign in to do that.", 401, "unauthorized") };
  }
  return { ok: true, user };
}

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail("That request body was not valid JSON.", 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json<ApiError>(
        {
          error: parsed.error.issues[0]?.message ?? "Some of those details were not valid.",
          code: "invalid_input",
          details: parsed.error.flatten(),
        },
        { status: 422 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Turns any thrown error into a response a person can act on. Provider errors
 * already carry a user-facing message; anything else is deliberately vague
 * outward and detailed only in the server log.
 */
export function handleError(error: unknown, context: string) {
  if (error instanceof IntegrationError) {
    const status =
      error.code === "not_configured" ? 503
      : error.code === "rate_limited" ? 429
      : error.code === "auth_expired" || error.code === "auth_invalid" ? 401
      : error.code === "unsupported" ? 400
      : 502;
    return NextResponse.json<ApiError>(
      { error: error.userMessage, code: error.code },
      { status },
    );
  }

  console.error(`[api] ${context}`, error);
  return fail("Something went wrong on our side. Please try again.", 500, "internal");
}

export async function writeAudit(params: {
  orgId: string;
  userId?: string | null;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      orgId: params.orgId,
      userId: params.userId ?? null,
      action: params.action,
      target: params.target,
      metadata: (params.metadata ?? {}) as never,
    },
  });
}

/* --------------------------------------------------------------- limits */

export interface PlanLimits {
  name: string;
  maxConnections: number;
  maxSyncs: number;
  monthlyOps: number;
  advancedRules: boolean;
  auditLogs: boolean;
  teamFeatures: boolean;
}

const FALLBACK: PlanLimits = {
  name: "Free",
  maxConnections: 3,
  maxSyncs: 3,
  monthlyOps: 500,
  advancedRules: false,
  auditLogs: false,
  teamFeatures: false,
};

export async function planFor(orgId: string): Promise<PlanLimits> {
  const subscription = await db.subscription.findUnique({
    where: { orgId },
    include: { plan: true },
  });
  if (!subscription?.plan) return FALLBACK;
  const { plan } = subscription;
  return {
    name: plan.name,
    maxConnections: plan.maxConnections,
    maxSyncs: plan.maxSyncs,
    monthlyOps: plan.monthlyOps,
    advancedRules: plan.advancedRules,
    auditLogs: plan.auditLogs,
    teamFeatures: plan.teamFeatures,
  };
}

/** -1 means unlimited. */
export function withinLimit(current: number, limit: number): boolean {
  return limit === -1 || current < limit;
}
