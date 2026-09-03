-- Auralis: complete database setup
--
-- Paste this whole file into the Supabase SQL Editor and press Run. It is
-- everything the app needs: schema, indexes, foreign keys and the three plan
-- rows.
--
-- Safe to run more than once: every statement is guarded, so a second run
-- changes nothing rather than failing on objects that already exist.
--
-- Generated from prisma/migrations/20260902215752_init/migration.sql

BEGIN;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH', 'DISABLED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SyncDirection" AS ENUM ('ONE_WAY', 'TWO_WAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ConflictPolicy" AS ENUM ('ASK', 'PREFER_SOURCE', 'PREFER_TARGET', 'NEWEST_WINS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SyncFrequency" AS ENUM ('REALTIME', 'EVERY_15_MIN', 'HOURLY', 'DAILY', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EventLevel" AS ENUM ('SUCCESS', 'INFO', 'WARNING', 'ERROR', 'CONFLICT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PLUS', 'BUSINESS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Connection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "externalId" TEXT,
    "accountLabel" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusDetail" TEXT,
    "scopes" TEXT[],
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OAuthCredential" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "accessTokenCipher" TEXT NOT NULL,
    "refreshTokenCipher" TEXT,
    "tokenType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "redirectTo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CanonicalRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "externalKey" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FieldCheckpoint" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "value" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SyncConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "sourceConnectionId" TEXT NOT NULL,
    "targetConnectionId" TEXT NOT NULL,
    "fields" TEXT[],
    "direction" "SyncDirection" NOT NULL DEFAULT 'ONE_WAY',
    "frequency" "SyncFrequency" NOT NULL DEFAULT 'HOURLY',
    "conflictPolicy" "ConflictPolicy" NOT NULL DEFAULT 'ASK',
    "propagateDeletes" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SyncJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "syncConfigId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'sync',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SyncEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "syncConfigId" TEXT,
    "connectionId" TEXT,
    "level" "EventLevel" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "field" TEXT,
    "sourceLabel" TEXT,
    "targetLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Conflict" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "syncConfigId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "sourceValue" TEXT,
    "targetValue" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Rule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" JSONB NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "lastFiredAt" TIMESTAMP(3),
    "fireCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "maxConnections" INTEGER NOT NULL,
    "maxSyncs" INTEGER NOT NULL,
    "monthlyOps" INTEGER NOT NULL,
    "advancedRules" BOOLEAN NOT NULL DEFAULT false,
    "auditLogs" BOOLEAN NOT NULL DEFAULT false,
    "teamFeatures" BOOLEAN NOT NULL DEFAULT false,
    "prioritySync" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "opsThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Connection_orgId_status_idx" ON "Connection"("orgId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Connection_provider_idx" ON "Connection"("provider");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Connection_orgId_provider_externalId_key" ON "Connection"("orgId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OAuthCredential_connectionId_key" ON "OAuthCredential"("connectionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OAuthCredential_expiresAt_idx" ON "OAuthCredential"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OAuthState_state_key" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CanonicalRecord_orgId_recordType_idx" ON "CanonicalRecord"("orgId", "recordType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CanonicalRecord_orgId_recordType_externalKey_key" ON "CanonicalRecord"("orgId", "recordType", "externalKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FieldCheckpoint_connectionId_idx" ON "FieldCheckpoint"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FieldCheckpoint_recordId_connectionId_field_key" ON "FieldCheckpoint"("recordId", "connectionId", "field");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncConfig_orgId_enabled_idx" ON "SyncConfig"("orgId", "enabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncConfig_nextRunAt_idx" ON "SyncConfig"("nextRunAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncJob_status_runAt_idx" ON "SyncJob"("status", "runAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncJob_orgId_createdAt_idx" ON "SyncJob"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncJob_syncConfigId_idx" ON "SyncJob"("syncConfigId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncEvent_orgId_createdAt_idx" ON "SyncEvent"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncEvent_orgId_level_idx" ON "SyncEvent"("orgId", "level");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Conflict_orgId_status_idx" ON "Conflict"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Conflict_syncConfigId_recordId_field_status_key" ON "Conflict"("syncConfigId", "recordId", "field", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Rule_orgId_enabled_idx" ON "Rule"("orgId", "enabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Plan_tier_key" ON "Plan"("tier");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_orgId_key" ON "Subscription"("orgId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Connection" ADD CONSTRAINT "Connection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "OAuthCredential" ADD CONSTRAINT "OAuthCredential_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CanonicalRecord" ADD CONSTRAINT "CanonicalRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FieldCheckpoint" ADD CONSTRAINT "FieldCheckpoint_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CanonicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FieldCheckpoint" ADD CONSTRAINT "FieldCheckpoint_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SyncConfig" ADD CONSTRAINT "SyncConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SyncConfig" ADD CONSTRAINT "SyncConfig_sourceConnectionId_fkey" FOREIGN KEY ("sourceConnectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SyncConfig" ADD CONSTRAINT "SyncConfig_targetConnectionId_fkey" FOREIGN KEY ("targetConnectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_syncConfigId_fkey" FOREIGN KEY ("syncConfigId") REFERENCES "SyncConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_syncConfigId_fkey" FOREIGN KEY ("syncConfigId") REFERENCES "SyncConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_syncConfigId_fkey" FOREIGN KEY ("syncConfigId") REFERENCES "SyncConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CanonicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Rule" ADD CONSTRAINT "Rule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------- plan rows
-- The app reads its limits from these rows rather than from constants in code.
-- Without them a new workspace has no subscription and falls back to Free.

INSERT INTO "Plan" (id, tier, name, "priceMonthly", "maxConnections", "maxSyncs",
                    "monthlyOps", "advancedRules", "auditLogs", "teamFeatures", "prioritySync")
VALUES
  ('plan_free',     'FREE',     'Free',        0,  3,  3,    500, false, false, false, false),
  ('plan_plus',     'PLUS',     'Plus',      900, 15, -1,  10000, true,  false, false, true),
  ('plan_business', 'BUSINESS', 'Business', 2900, -1, -1, 250000, true,  true,  true,  true)
ON CONFLICT (tier) DO UPDATE SET
  name             = EXCLUDED.name,
  "priceMonthly"   = EXCLUDED."priceMonthly",
  "maxConnections" = EXCLUDED."maxConnections",
  "maxSyncs"       = EXCLUDED."maxSyncs",
  "monthlyOps"     = EXCLUDED."monthlyOps",
  "advancedRules"  = EXCLUDED."advancedRules",
  "auditLogs"      = EXCLUDED."auditLogs",
  "teamFeatures"   = EXCLUDED."teamFeatures",
  "prioritySync"   = EXCLUDED."prioritySync";

COMMIT;
