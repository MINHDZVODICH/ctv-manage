-- updatedAt is managed by Prisma in UTC. A PostgreSQL session configured with
-- Asia/Bangkok must not cast CURRENT_TIMESTAMP into a local timestamp here.
ALTER TABLE "WorkHistoryProgress" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- The initial boundary has not processed a day yet; timestamp its initialization
-- in UTC without changing either tracking date or any historical records.
UPDATE "WorkHistoryProgress"
SET "updatedAt" = clock_timestamp() AT TIME ZONE 'UTC'
WHERE "lastProcessedDate" = "trackingStartDate" - 1;
