/**
 * Auralis background worker.
 *
 * Runs separately from the web process so a long provider call can never block a
 * request. Several instances can run at once — job claiming is atomic.
 *
 *   npm run worker
 */
import { db } from "../lib/db";
import {
  claimNextJob,
  completeJob,
  failJob,
  reclaimStalledJobs,
  scheduleDueSyncs,
} from "../lib/queue";
import { runSync } from "../lib/sync/engine";
import { IntegrationError } from "../lib/integrations/types";
import { randomUUID } from "node:crypto";

const WORKER_ID = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
const IDLE_POLL_MS = 2_000;
const MAINTENANCE_EVERY_MS = 60_000;

let running = true;
let lastMaintenance = 0;

function log(message: string, extra?: Record<string, unknown>) {
  const line = { at: new Date().toISOString(), worker: WORKER_ID, message, ...extra };
  console.log(JSON.stringify(line));
}

async function handleJob(job: Awaited<ReturnType<typeof claimNextJob>>) {
  if (!job) return;

  if (job.kind !== "sync" || !job.syncConfigId) {
    await completeJob(job.id);
    return;
  }

  const config = await db.syncConfig.findUnique({
    where: { id: job.syncConfigId },
    include: { source: true, target: true },
  });

  if (!config || !config.enabled) {
    await completeJob(job.id);
    return;
  }

  try {
    const outcome = await runSync(config);
    await completeJob(job.id);
    log("sync completed", {
      syncConfigId: config.id,
      applied: outcome.applied,
      conflicts: outcome.conflicts,
      skipped: outcome.skipped,
    });
  } catch (error) {
    const integrationError = error instanceof IntegrationError ? error : null;
    const message = integrationError?.userMessage
      ?? (error instanceof Error ? error.message : "An unexpected error occurred.");

    const result = await failJob({
      jobId: job.id,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error: message,
      retryable: integrationError ? integrationError.retryable : true,
      retryAfterMs: integrationError?.retryAfterMs,
    });

    // Only surface a failure to the user once retries are exhausted; a transient
    // blip that recovers on retry is noise, not news.
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

    log("sync failed", {
      syncConfigId: config.id,
      willRetry: result.willRetry,
      attempts: job.attempts,
      error: message,
    });
  }
}

async function maintenance() {
  const reclaimed = await reclaimStalledJobs();
  const scheduled = await scheduleDueSyncs();
  if (reclaimed || scheduled) {
    log("maintenance", { reclaimed, scheduled });
  }
}

async function loop() {
  log("worker started");
  while (running) {
    try {
      if (Date.now() - lastMaintenance > MAINTENANCE_EVERY_MS) {
        lastMaintenance = Date.now();
        await maintenance();
      }

      const job = await claimNextJob(WORKER_ID);
      if (!job) {
        await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
        continue;
      }
      await handleJob(job);
    } catch (error) {
      // The loop itself must never die; a database blip should not stop the worker.
      log("worker loop error", { error: String(error) });
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  await db.$disconnect();
  log("worker stopped");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log("shutdown requested", { signal });
    running = false;
  });
}

loop();
