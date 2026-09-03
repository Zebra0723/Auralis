import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  claimNextJob,
  completeJob,
  failJob,
  reclaimStalledJobs,
  scheduleDueSyncs,
} from "@/lib/queue";
import { runSync } from "@/lib/sync/engine";
import { IntegrationError } from "@/lib/integrations/types";

/**
 * Serverless drain for the job queue.
 *
 * The long-lived worker in worker/index.ts cannot run on a request-scoped
 * platform, so this endpoint does one bounded pass instead: schedule what is
 * due, then work the queue until either it empties or the time budget is spent.
 * Vercel Cron calls it on a schedule (see vercel.json).
 *
 * Both paths share the same queue and engine, so behaviour does not diverge
 * between a hosted worker and a cron drain.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Leave headroom below maxDuration so an in-flight job can finish and be
// recorded rather than being killed mid-write and left as a stalled row.
const TIME_BUDGET_MS = 45_000;

export async function GET(request: Request) {
  // Vercel Cron sends this header; a manual call must present CRON_SECRET.
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const secret = process.env.CRON_SECRET;
  const authorised =
    isVercelCron ||
    (secret !== undefined && request.headers.get("authorization") === `Bearer ${secret}`);

  if (!authorised) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const startedAt = Date.now();
  const workerId = `cron-${startedAt}`;
  let processed = 0;
  let failed = 0;

  const reclaimed = await reclaimStalledJobs();
  const scheduled = await scheduleDueSyncs();

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const job = await claimNextJob(workerId);
    if (!job) break;

    if (job.kind !== "sync" || !job.syncConfigId) {
      await completeJob(job.id);
      continue;
    }

    const config = await db.syncConfig.findUnique({
      where: { id: job.syncConfigId },
      include: { source: true, target: true },
    });

    if (!config || !config.enabled) {
      await completeJob(job.id);
      continue;
    }

    try {
      await runSync(config);
      await completeJob(job.id);
      processed++;
    } catch (error) {
      const integrationError = error instanceof IntegrationError ? error : null;
      const message =
        integrationError?.userMessage ??
        (error instanceof Error ? error.message : "An unexpected error occurred.");

      const result = await failJob({
        jobId: job.id,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        error: message,
        retryable: integrationError ? integrationError.retryable : true,
        retryAfterMs: integrationError?.retryAfterMs,
      });

      if (!result.willRetry) {
        await db.syncEvent.create({
          data: {
            orgId: config.orgId,
            syncConfigId: config.id,
            level: "ERROR",
            title: `${config.name} could not complete`,
            detail: message,
            sourceLabel: config.source.displayName,
            targetLabel: config.target.displayName,
          },
        });
      }
      failed++;
    }
  }

  return NextResponse.json({
    reclaimed,
    scheduled,
    processed,
    failed,
    durationMs: Date.now() - startedAt,
  });
}
