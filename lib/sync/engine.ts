import { db } from "@/lib/db";
import { valueHash } from "@/lib/crypto";
import { getIntegration } from "@/lib/integrations/registry";
import { fieldLabel } from "@/lib/integrations/fields";
import {
  IntegrationError,
  isAuthError,
  type RecordType,
  type RemoteRecord,
} from "@/lib/integrations/types";
import {
  getConnectionContext,
  markConnectionNeedsReauth,
} from "@/lib/sync/connection-context";
import { runRulesForChange } from "@/lib/sync/rules";
import type { SyncConfig, Connection, ConflictPolicy, Prisma } from "@prisma/client";

export interface SyncOutcome {
  applied: number;
  conflicts: number;
  skipped: number;
  fieldsChanged: string[];
}

type Side = "source" | "target";

/**
 * Reconcile one sync configuration.
 *
 * The rule that matters: a value is only written when exactly one side has moved
 * since the last checkpoint. If both moved, that is a genuine conflict and the
 * field is left alone until a human (or an explicit policy) decides. This is why
 * FieldCheckpoint exists — without stored history, "both changed" is
 * indistinguishable from "one changed", and the newer write silently wins.
 */
export async function runSync(
  config: SyncConfig & { source: Connection; target: Connection },
): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { applied: 0, conflicts: 0, skipped: 0, fieldsChanged: [] };
  const recordType = config.recordType as RecordType;

  const sourceIntegration = getIntegration(config.source.provider);
  const targetIntegration = getIntegration(config.target.provider);

  const [sourceCtx, targetCtx] = await Promise.all([
    getConnectionContext(config.source),
    getConnectionContext(config.target),
  ]);

  let sourceRecords: RemoteRecord[];
  let targetRecords: RemoteRecord[];
  try {
    [sourceRecords, targetRecords] = await Promise.all([
      sourceIntegration.getData(sourceCtx, recordType),
      targetIntegration.getData(targetCtx, recordType),
    ]);
  } catch (error) {
    if (isAuthError(error) && error instanceof IntegrationError) {
      // Attribute the failure to whichever side is actually broken.
      const broken = await whichSideFailed(config, sourceCtx.accessToken, error);
      await markConnectionNeedsReauth(broken.id, error.userMessage);
      await logEvent(config, "ERROR", `${broken.displayName} needs reconnecting`, error.userMessage);
    }
    throw error;
  }

  const sourceRecord = sourceRecords[0];
  const targetRecord = targetRecords[0];

  if (!sourceRecord) {
    await logEvent(config, "INFO", "Nothing to sync", `${config.source.displayName} returned no ${recordType} record.`);
    return outcome;
  }

  const canonical = await ensureCanonicalRecord(config.orgId, recordType, sourceRecord);

  for (const field of config.fields) {
    const sourceValue = normalise(sourceRecord.fields[field]);
    const targetValue = normalise(targetRecord?.fields[field]);

    const [sourceCheckpoint, targetCheckpoint] = await Promise.all([
      getCheckpoint(canonical.id, config.sourceConnectionId, field),
      getCheckpoint(canonical.id, config.targetConnectionId, field),
    ]);

    const [sourceHash, targetHash] = await Promise.all([
      valueHash(sourceValue),
      valueHash(targetValue),
    ]);
    const sourceMoved = sourceCheckpoint !== null && sourceCheckpoint !== sourceHash;
    const targetMoved = targetCheckpoint !== null && targetCheckpoint !== targetHash;
    const inAgreement = sourceHash === targetHash;

    if (inAgreement) {
      // Already consistent. Record checkpoints so future divergence is detectable.
      await Promise.all([
        setCheckpoint(canonical.id, config.sourceConnectionId, field, sourceValue),
        setCheckpoint(canonical.id, config.targetConnectionId, field, targetValue),
      ]);
      outcome.skipped++;
      continue;
    }

    // Both sides changed independently: do not guess.
    if (sourceMoved && targetMoved) {
      const resolved = await resolveByPolicy(config, field, sourceValue, targetValue);
      if (!resolved.decided) {
        await raiseConflict(config, canonical.id, field, sourceValue, targetValue);
        outcome.conflicts++;
        continue;
      }
      if (resolved.winner === "target") {
        // Target wins: pull its value back into the canonical record instead.
        await applyToCanonical(canonical.id, field, targetValue);
        await setCheckpoint(canonical.id, config.sourceConnectionId, field, targetValue);
        await setCheckpoint(canonical.id, config.targetConnectionId, field, targetValue);
        outcome.applied++;
        outcome.fieldsChanged.push(field);
        continue;
      }
    }

    // One-way syncs never write back to the source, even if the target moved.
    if (config.direction === "ONE_WAY" && targetMoved && !sourceMoved) {
      outcome.skipped++;
      continue;
    }

    const writable = targetIntegration.descriptor.capabilities.fields[recordType]?.find(
      (f) => f.key === field && f.writable,
    );
    if (!writable) {
      outcome.skipped++;
      continue;
    }

    if (sourceValue === null && !config.propagateDeletes) {
      outcome.skipped++;
      continue;
    }

    await targetIntegration.updateData(
      targetCtx,
      recordType,
      targetRecord?.externalId ?? sourceRecord.externalId,
      { [field]: sourceValue },
    );

    await applyToCanonical(canonical.id, field, sourceValue);
    await Promise.all([
      setCheckpoint(canonical.id, config.sourceConnectionId, field, sourceValue),
      setCheckpoint(canonical.id, config.targetConnectionId, field, sourceValue),
    ]);

    outcome.applied++;
    outcome.fieldsChanged.push(field);

    await logEvent(
      config,
      "SUCCESS",
      `${fieldLabel(field)} updated`,
      `${describe(sourceValue)} written to ${config.target.displayName}.`,
      field,
    );

    await runRulesForChange({
      orgId: config.orgId,
      connectionId: config.sourceConnectionId,
      recordType,
      field,
      value: sourceValue,
    });
  }

  await db.syncConfig.update({
    where: { id: config.id },
    data: { lastRunAt: new Date() },
  });

  await db.connection.updateMany({
    where: { id: { in: [config.sourceConnectionId, config.targetConnectionId] } },
    data: { lastSyncedAt: new Date() },
  });

  return outcome;
}

/* ------------------------------------------------------------- helpers */

function normalise(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function describe(value: string | null): string {
  if (value === null) return "An empty value was";
  return `"${value.length > 60 ? `${value.slice(0, 57)}...` : value}" was`;
}

async function whichSideFailed(
  config: SyncConfig & { source: Connection; target: Connection },
  _sourceToken: string,
  _error: IntegrationError,
): Promise<Connection> {
  // Probe the source cheaply; if it answers, the target is the broken side.
  try {
    const ctx = await getConnectionContext(config.source);
    await getIntegration(config.source.provider).getData(ctx, config.recordType as RecordType);
    return config.target;
  } catch {
    return config.source;
  }
}

async function ensureCanonicalRecord(
  orgId: string,
  recordType: RecordType,
  seed: RemoteRecord,
) {
  const existing = await db.canonicalRecord.findFirst({
    where: { orgId, recordType },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return db.canonicalRecord.create({
    data: {
      orgId,
      recordType,
      externalKey: seed.fields.email ?? null,
      fields: Object.fromEntries(
        Object.entries(seed.fields).filter(([, v]) => v !== null && v !== undefined),
      ),
    },
  });
}

async function getCheckpoint(
  recordId: string,
  connectionId: string,
  field: string,
): Promise<string | null> {
  const row = await db.fieldCheckpoint.findUnique({
    where: { recordId_connectionId_field: { recordId, connectionId, field } },
  });
  return row?.valueHash ?? null;
}

async function setCheckpoint(
  recordId: string,
  connectionId: string,
  field: string,
  value: string | null,
): Promise<void> {
  const data = { valueHash: await valueHash(value), value, observedAt: new Date() };
  await db.fieldCheckpoint.upsert({
    where: { recordId_connectionId_field: { recordId, connectionId, field } },
    create: { recordId, connectionId, field, ...data },
    update: data,
  });
}

async function applyToCanonical(
  recordId: string,
  field: string,
  value: string | null,
): Promise<void> {
  const record = await db.canonicalRecord.findUnique({ where: { id: recordId } });
  if (!record) return;
  const merged = {
    ...((record.fields ?? {}) as Record<string, unknown>),
    [field]: value,
  } as Prisma.InputJsonObject;
  await db.canonicalRecord.update({
    where: { id: recordId },
    data: { fields: merged, version: { increment: 1 } },
  });
}

async function resolveByPolicy(
  config: SyncConfig,
  _field: string,
  _sourceValue: string | null,
  _targetValue: string | null,
): Promise<{ decided: boolean; winner?: Side }> {
  const policy: ConflictPolicy = config.conflictPolicy;
  if (policy === "PREFER_SOURCE") return { decided: true, winner: "source" };
  if (policy === "PREFER_TARGET") return { decided: true, winner: "target" };
  if (policy === "NEWEST_WINS") {
    // Most providers do not expose per-field modification times, so "newest"
    // cannot be established honestly. Fall back to asking rather than guessing.
    return { decided: false };
  }
  return { decided: false };
}

async function raiseConflict(
  config: SyncConfig & { source: Connection; target: Connection },
  recordId: string,
  field: string,
  sourceValue: string | null,
  targetValue: string | null,
): Promise<void> {
  const existing = await db.conflict.findFirst({
    where: { syncConfigId: config.id, recordId, field, status: "OPEN" },
  });

  if (existing) {
    await db.conflict.update({
      where: { id: existing.id },
      data: { sourceValue, targetValue },
    });
    return;
  }

  await db.conflict.create({
    data: {
      orgId: config.orgId,
      syncConfigId: config.id,
      recordId,
      field,
      sourceValue,
      targetValue,
      sourceLabel: config.source.displayName,
      targetLabel: config.target.displayName,
    },
  });

  await logEvent(
    config,
    "CONFLICT",
    "Conflict detected",
    `${fieldLabel(field)} differs between ${config.source.displayName} and ${config.target.displayName}. Nothing was changed.`,
    field,
  );
}

export async function logEvent(
  config: SyncConfig & { source?: Connection; target?: Connection },
  level: "SUCCESS" | "INFO" | "WARNING" | "ERROR" | "CONFLICT",
  title: string,
  detail?: string,
  field?: string,
): Promise<void> {
  await db.syncEvent.create({
    data: {
      orgId: config.orgId,
      syncConfigId: config.id,
      level,
      title,
      detail,
      field,
      sourceLabel: config.source?.displayName,
      targetLabel: config.target?.displayName,
    },
  });
}
