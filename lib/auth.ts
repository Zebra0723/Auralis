import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { hashPassword, randomToken, sha256, verifyPassword } from "@/lib/crypto";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "auralis_session";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: Role;
};

/**
 * Sessions are opaque random tokens; only their SHA-256 is stored. A database
 * leak therefore does not hand an attacker usable session cookies, and logout
 * or revocation takes effect immediately (unlike a self-contained JWT).
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomToken(32);
  const hdrs = await headers();
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      userAgent: hdrs.get("user-agent")?.slice(0, 300) ?? null,
      ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86400_000),
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86400,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Cached per request so a page rendering ten components hits the DB once. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          memberships: { include: { org: true }, orderBy: { createdAt: "asc" }, take: 1 },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) return null;

  const membership = session.user.memberships[0];
  if (!membership) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    orgId: membership.orgId,
    orgName: membership.org.name,
    orgSlug: membership.org.slug,
    role: membership.role,
  };
});

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

/* ------------------------------------------------------------ registration */

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "workspace"
  );
}

export async function registerUser(params: {
  email: string;
  password: string;
  name?: string;
  orgName?: string;
}) {
  const email = params.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false as const, error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(params.password);
  const baseName = params.orgName?.trim() || `${params.name?.trim() || email.split("@")[0]}'s workspace`;

  // Slug collisions are possible across tenants, so probe for a free suffix.
  let slug = slugify(baseName);
  for (let i = 0; await db.organization.findUnique({ where: { slug } }); i++) {
    slug = `${slugify(baseName)}-${i + 2}`;
  }

  const freePlan = await db.plan.findUnique({ where: { tier: "FREE" } });

  const user = await db.user.create({
    data: {
      email,
      name: params.name?.trim() || null,
      passwordHash,
      memberships: {
        create: {
          role: "OWNER",
          org: {
            create: {
              name: baseName,
              slug,
              ...(freePlan
                ? { subscription: { create: { planId: freePlan.id } } }
                : {}),
            },
          },
        },
      },
    },
    include: { memberships: true },
  });

  return { ok: true as const, userId: user.id, orgId: user.memberships[0].orgId };
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Hash even when the user is absent so response time does not reveal
  // whether an address is registered.
  if (!user) {
    await verifyPassword(password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA");
    return { ok: false as const, error: "Incorrect email or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false as const, error: "Incorrect email or password." };

  return { ok: true as const, userId: user.id };
}
