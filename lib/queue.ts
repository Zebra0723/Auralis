import { db } from "@/lib/db";
import type { JobStatus, Prisma } from "@prisma/client";

/**
 * A Postgres-backed job queue.
 *
 * Claiming uses SELECT ... FOR UPDATE SKIP LOCKED, which lets several workers
 * pull from the same table without blocking each other and without a separate
 * broker. One less piece of infrastructure to run, and jobs are transactional
 * with the data they operate on.
 */

export interface EnqueueParams {
  orgId: string;
  kind?: string;
  syncConfigId?: string | null;
  payload?: Prisma.InputJsonValue;
  runAt?: Date;
  maxAttempts?: number;
}

export async function enqueue(params: EnqueueParams) {
  return db.syncJob.create({
    data: {
      orgId: params.orgId,
      kind: params.kind ?? "sync",
      syncConfigId: params.syncConfigId ?? null,
      payload: params.payload ?? {},
      runAt: params.runAt ?? new Date(),
      maxAttempts: params.maxAttempts ?? 5,
    },
  });
}

export interface ClaimedJob {
  id: string;
  orgId: string;
  kind: string;
  syncConfigId: string | null;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

/**
 * Atomically claim the next due job. The UPDATE ... FROM (SELECT ... SKIP LOCKED)
 * form means the claim and the status change happen in one statement, so a
 * worker crashing between them cannot leave a job claimed-but-not-running.
 */
export async function claimNextJob(workerId: string): Promise<ClaimedJob | null> {
  const rows = await db.$queryRaw<ClaimedJob[]>`
    UPDATE "SyncJob" AS j
    SET status = 'RUNNING',
        "lockedBy" = ${workerId},
        "lockedAt" = NOW(),
        "startedAt" = COALESCE(j."startedAt", NOW()),
        attempts = j.attempts + 1,
        "updatedAt" = NOW()
    FROM (
      SELECT id
      FROM "SyncJob"
      WHERE status IN ('QUEUED', 'RETRYING')
        AND "runAt" <= NOW()
      ORDER BY "runAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ) AS next
    WHERE j.id = next.id
    RETURNING j.id, j."orgId", j.kind, j."syncConfigId", j.payload,
              j.attempts, j."maxAttempts";
  `;
  return rows[0] ?? null;
}

export async function completeJob(jobId: string): Promise<void> {
  await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      lockedBy: null,
      lockedAt: null,
      lastError: null,
    },
  });
}

/**
 * Exponential backoff with jitter: 30s, 1m, 2m, 4m, 8m, capped at an hour.
 * Jitter matters when a provider outage fails many jobs at once — without it
 * they all retry in the same instant and hammer the recovering service.
 */
export function backoffMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) return Math.min(retryAfterMs, 3_600_000);
  const base = Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 3_600_000);
  const jitter = base * 0.25 * Math.random();
  return Math.round(base + jitter);
}

export async function failJob(params: {
  jobId: string;
  attempts: number;
  maxAttempts: number;
  error: string;
  retryable: boolean;
  retryAfterMs?: number;
}): Promise<{ willRetry: boolean; nextRunAt?: Date }> {
  const exhausted = params.attempts >= params.maxAttempts;
  const willRetry = params.retryable && !exhausted;

  if (!willRetry) {
    await db.syncJob.update({
      where: { id: params.jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        lastError: params.error.slice(0, 1000),
      },
    });
    return { willRetry: false };
  }

  const nextRunAt = new Date(Date.now() + backoffMs(params.attempts, params.retryAfterMs));
  await db.syncJob.update({
    where: { id: params.jobId },
    data: {
      status: "RETRYING",
      runAt: nextRunAt,
      lockedBy: null,
      lockedAt: null,
      lastError: params.error.slice(0, 1000),
    },
  });
  return { willRetry: true, nextRunAt };
}

/**
 * Return jobs whose worker died mid-run to the queue. Without this a crashed
 * worker's jobs would sit in RUNNING forever.
 */
export async function reclaimStalledJobs(olderThanMs = 300_000): Promise<number> {
  const result = await db.syncJob.updateMany({
    where: {
      status: "RUNNING",
      lockedAt: { lt: new Date(Date.now() - olderThanMs) },
    },
    data: { status: "RETRYING", lockedBy: null, lockedAt: null, runAt: new Date() },
  });
  return result.count;
}

/** Queue jobs for every sync whose schedule has come due. */
export async function scheduleDueSyncs(): Promise<number> {
  const due = await db.syncConfig.findMany({
    where: {
      enabled: true,
      frequency: { not: "MANUAL" },
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
    },
    select: { id: true, orgId: true, frequency: true },
  });

  for (const config of due) {
    await enqueue({ orgId: config.orgId, syncConfigId: config.id });
    await db.syncConfig.update({
      where: { id: config.id },
      data: { nextRunAt: nextRunFor(config.frequency) },
    });
  }
  return due.length;
}

export function nextRunFor(frequency: string): Date {
  const minutes =
    frequency === "REALTIME" ? 5
    : frequency === "EVERY_15_MIN" ? 15
    : frequency === "HOURLY" ? 60
    : frequency === "DAILY" ? 1440
    : 60;
  return new Date(Date.now() + minutes * 60_000);
}

export async function queueStats(orgId: string): Promise<Record<JobStatus, number>> {
  const rows = await db.syncJob.groupBy({
    by: ["status"],
    where: { orgId },
    _count: { status: true },
  });
  const base: Record<string, number> = {
    QUEUED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, RETRYING: 0, CANCELLED: 0,
  };
  for (const row of rows) base[row.status] = row._count.status;
  return base as Record<JobStatus, number>;
}
