import { db } from "@/lib/db";
import { ok, requireUser } from "@/lib/api";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/activity?level=ERROR&cursor=<id>&limit=50
 *
 * Cursor pagination rather than offset: the feed is append-heavy, and an offset
 * would skip or repeat rows as new events arrive mid-scroll.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const level = url.searchParams.get("level");
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

  const where: Prisma.SyncEventWhereInput = { orgId: auth.user.orgId };
  if (level && ["SUCCESS", "INFO", "WARNING", "ERROR", "CONFLICT"].includes(level)) {
    where.level = level as Prisma.SyncEventWhereInput["level"];
  }

  const events = await db.syncEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = events.length > limit;
  return ok({
    events: hasMore ? events.slice(0, limit) : events,
    nextCursor: hasMore ? events[limit - 1].id : null,
  });
}
