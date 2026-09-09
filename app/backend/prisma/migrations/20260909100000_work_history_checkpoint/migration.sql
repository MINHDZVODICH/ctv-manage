BEGIN;

CREATE TABLE "WorkHistoryProgress" (
  "id" TEXT PRIMARY KEY DEFAULT 'default',
  "trackingStartDate" DATE NOT NULL,
  "lastProcessedDate" DATE NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkHistoryProgress_singleton" CHECK ("id" = 'default'),
  CONSTRAINT "WorkHistoryProgress_boundary" CHECK ("lastProcessedDate" >= "trackingStartDate" - 1)
);

CREATE TABLE "WorkHistorySource" (
  "id" BIGSERIAL PRIMARY KEY,
  "accountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "transactionId" BIGINT NOT NULL,
  "effectiveAt" TIMESTAMPTZ(3) NOT NULL,
  "eligible" BOOLEAN NOT NULL,
  "roomCode" TEXT,
  "shifts" JSONB NOT NULL
);
CREATE UNIQUE INDEX "WorkHistorySource_accountId_transactionId_key" ON "WorkHistorySource"("accountId", "transactionId");
CREATE INDEX "WorkHistorySource_accountId_effectiveAt_id_idx" ON "WorkHistorySource"("accountId", "effectiveAt", "id");

CREATE FUNCTION capture_work_history_source(target_account TEXT) RETURNS VOID AS $$
BEGIN
  -- Writers share this lock; the snapshot takes it exclusively before reading.
  PERFORM pg_advisory_xact_lock_shared(17300909);
  -- Serialize revisions for the same account, including concurrent status and schedule edits.
  PERFORM pg_advisory_xact_lock(hashtextextended(target_account, 17300909));
  INSERT INTO "WorkHistorySource" ("accountId", "transactionId", "effectiveAt", "eligible", "roomCode", "shifts")
  SELECT a."id", txid_current(), clock_timestamp(),
         a."role" = 'CTV' AND a."status" = 'ACTIVE' AND a."deletedAt" IS NULL AND s."id" IS NOT NULL,
         s."roomCode",
         COALESCE((SELECT jsonb_agg(jsonb_build_object('weekday', sh."weekday", 'period', sh."period") ORDER BY sh."weekday", sh."period")
                   FROM "Shift" sh WHERE sh."scheduleId" = s."id"), '[]'::jsonb)
  FROM "Account" a LEFT JOIN "Schedule" s ON s."accountId" = a."id"
  WHERE a."id" = target_account
  ON CONFLICT ("accountId", "transactionId") DO UPDATE SET
    "effectiveAt" = EXCLUDED."effectiveAt", "eligible" = EXCLUDED."eligible",
    "roomCode" = EXCLUDED."roomCode", "shifts" = EXCLUDED."shifts";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION capture_work_history_change() RETURNS TRIGGER AS $$
DECLARE target_account TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Account' THEN
    target_account := NEW."id";
  ELSIF TG_TABLE_NAME = 'Schedule' THEN
    IF TG_OP = 'DELETE' THEN target_account := OLD."accountId";
    ELSE target_account := NEW."accountId"; END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      SELECT "accountId" INTO target_account FROM "Schedule" WHERE "id" = OLD."scheduleId";
    ELSE
      SELECT "accountId" INTO target_account FROM "Schedule" WHERE "id" = NEW."scheduleId";
    END IF;
  END IF;
  IF target_account IS NOT NULL THEN PERFORM capture_work_history_source(target_account); END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Deferred triggers see the complete new schedule, including all replacement shifts.
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

-- Establish a baseline, never pretending to know the schedule before deployment.
SELECT capture_work_history_source("id") FROM "Account";
WITH boundary AS (
  SELECT (clock_timestamp() AT TIME ZONE 'Asia/Bangkok') AS local_now
), start_date AS (
  SELECT local_now::date + CASE WHEN local_now::time >= TIME '17:30' THEN 1 ELSE 0 END AS day FROM boundary
)
INSERT INTO "WorkHistoryProgress" ("id", "trackingStartDate", "lastProcessedDate")
SELECT 'default', day, day - 1 FROM start_date;

COMMIT;
