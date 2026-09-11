-- Drop dependent triggers before column type alteration
DROP TRIGGER IF EXISTS work_history_account_insert ON "Account";
DROP TRIGGER IF EXISTS work_history_account_update ON "Account";
DROP TRIGGER IF EXISTS work_history_schedule ON "Schedule";
DROP TRIGGER IF EXISTS work_history_shift ON "Shift";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CTV');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FileState" AS ENUM ('STAGED', 'ACTIVE', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('AVATAR', 'CCCD_FRONT', 'CCCD_BACK', 'CV');

-- CreateEnum
CREATE TYPE "RoomCode" AS ENUM ('ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4');

-- CreateEnum
CREATE TYPE "Period" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "HistoryStatus" AS ENUM ('COMPLETED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SnapshotRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'MISSED');

-- CreateEnum
CREATE TYPE "RateLimitScope" AS ENUM ('LOGIN_IP', 'LOGIN_ACCOUNT', 'REGISTRATION_IP', 'UPLOAD_ACCOUNT');

-- AlterTable Account
ALTER TABLE "Account"
  ALTER COLUMN "role" TYPE "Role" USING "role"::"Role",
  ALTER COLUMN "status" TYPE "AccountStatus" USING "status"::"AccountStatus";

-- AlterTable RegistrationRequest
ALTER TABLE "RegistrationRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "RegistrationStatus" USING "status"::"RegistrationStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING'::"RegistrationStatus";

-- AlterTable FileAsset
ALTER TABLE "FileAsset"
  ALTER COLUMN "state" TYPE "FileState" USING "state"::"FileState";

-- AlterTable RegistrationRequestFile
ALTER TABLE "RegistrationRequestFile"
  ALTER COLUMN "category" TYPE "FileCategory" USING "category"::"FileCategory";

-- AlterTable AccountFile
ALTER TABLE "AccountFile"
  ALTER COLUMN "category" TYPE "FileCategory" USING "category"::"FileCategory";

-- AlterTable Schedule
ALTER TABLE "Schedule"
  ALTER COLUMN "roomCode" TYPE "RoomCode" USING "roomCode"::"RoomCode";

-- AlterTable Shift
ALTER TABLE "Shift"
  ALTER COLUMN "period" TYPE "Period" USING "period"::"Period";

-- AlterTable History
ALTER TABLE "History"
  ALTER COLUMN "period" TYPE "Period" USING "period"::"Period",
  ALTER COLUMN "roomCode" TYPE "RoomCode" USING "roomCode"::"RoomCode",
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "HistoryStatus" USING "status"::"HistoryStatus",
  ALTER COLUMN "status" SET DEFAULT 'COMPLETED'::"HistoryStatus";

-- AlterTable SnapshotRun
ALTER TABLE "SnapshotRun"
  ALTER COLUMN "status" TYPE "SnapshotRunStatus" USING "status"::"SnapshotRunStatus";

-- AlterTable RateLimitWindow
ALTER TABLE "RateLimitWindow"
  ALTER COLUMN "scope" TYPE "RateLimitScope" USING "scope"::"RateLimitScope";

-- AddCheckConstraints
ALTER TABLE "Shift"
  ADD CONSTRAINT "Shift_weekday_check" CHECK ("weekday" BETWEEN 1 AND 5);

ALTER TABLE "SnapshotRun"
  ADD CONSTRAINT "SnapshotRun_attemptCount_check" CHECK ("attemptCount" >= 0),
  ADD CONSTRAINT "SnapshotRun_insertedCount_check" CHECK ("insertedCount" >= 0);

ALTER TABLE "RateLimitWindow"
  ADD CONSTRAINT "RateLimitWindow_requestCount_check" CHECK ("requestCount" >= 0);

-- Update capture_work_history_source function for enum compatibility
CREATE OR REPLACE FUNCTION capture_work_history_source(target_account TEXT) RETURNS VOID AS $$
BEGIN
  -- Writers share this lock; the snapshot takes it exclusively before reading.
  PERFORM pg_advisory_xact_lock_shared(17300909);
  -- Serialize revisions for the same account, including concurrent status and schedule edits.
  PERFORM pg_advisory_xact_lock(hashtextextended(target_account, 17300909));
  INSERT INTO "WorkHistorySource" ("accountId", "transactionId", "effectiveAt", "eligible", "roomCode", "shifts")
  SELECT a."id", txid_current(), clock_timestamp(),
         a."role" = 'CTV'::"Role" AND a."status" = 'ACTIVE'::"AccountStatus" AND a."deletedAt" IS NULL AND s."id" IS NOT NULL,
         s."roomCode"::text,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('weekday', sh."weekday", 'period', sh."period"::text) ORDER BY sh."weekday", sh."period")
                   FROM "Shift" sh WHERE sh."scheduleId" = s."id"), '[]'::jsonb)
  FROM "Account" a LEFT JOIN "Schedule" s ON s."accountId" = a."id"
  WHERE a."id" = target_account
  ON CONFLICT ("accountId", "transactionId") DO UPDATE SET
    "effectiveAt" = EXCLUDED."effectiveAt", "eligible" = EXCLUDED."eligible",
    "roomCode" = EXCLUDED."roomCode", "shifts" = EXCLUDED."shifts";
END;
$$ LANGUAGE plpgsql;

-- Re-create dependent triggers
CREATE CONSTRAINT TRIGGER work_history_account_insert AFTER INSERT ON "Account"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_work_history_change();

CREATE CONSTRAINT TRIGGER work_history_account_update AFTER UPDATE ON "Account"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
WHEN (OLD."role" IS DISTINCT FROM NEW."role" OR OLD."status" IS DISTINCT FROM NEW."status" OR OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION capture_work_history_change();

CREATE CONSTRAINT TRIGGER work_history_schedule AFTER INSERT OR UPDATE OR DELETE ON "Schedule"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_work_history_change();

CREATE CONSTRAINT TRIGGER work_history_shift AFTER INSERT OR UPDATE OR DELETE ON "Shift"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_work_history_change();
