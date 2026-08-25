-- Preserve historical registrations while selecting the newest existing ACTIVE
-- registration as the current one for each CTV before the invariant is added.
UPDATE "ScheduleRegistration"
SET
  "status" = 'CANCELLED',
  "cancelledAt" = COALESCE("cancelledAt", CURRENT_TIMESTAMP)
WHERE "status" = 'ACTIVE'
  AND "id" IN (
    SELECT "older"."id"
    FROM "ScheduleRegistration" AS "older"
    INNER JOIN "ScheduleRegistration" AS "newer"
      ON "newer"."accountId" = "older"."accountId"
      AND "newer"."status" = 'ACTIVE'
      AND "older"."status" = 'ACTIVE'
      AND (
        "newer"."updatedAt" > "older"."updatedAt"
        OR ("newer"."updatedAt" = "older"."updatedAt" AND "newer"."id" > "older"."id")
      )
  );

CREATE UNIQUE INDEX "ScheduleRegistration_one_active_per_account"
ON "ScheduleRegistration"("accountId")
WHERE "status" = 'ACTIVE';
