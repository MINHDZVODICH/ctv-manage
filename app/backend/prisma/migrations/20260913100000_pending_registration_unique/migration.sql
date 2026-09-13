-- Migration: Enforce database-level uniqueness for pending registrations per email
-- Preflight check: Do NOT automatically alter applicant records or silently reject pending submissions.
-- If duplicate pending registrations exist for any email, abort migration with an exception requiring explicit manual remediation.
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "email"
    FROM "RegistrationRequest"
    WHERE "status" = 'PENDING'::"RegistrationStatus"
    GROUP BY "email"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index: % email(s) have duplicate PENDING registration requests. Explicit manual remediation is required before applying this migration.', duplicate_count;
  END IF;
END $$;

-- Enforce database-level uniqueness for pending registrations per email
CREATE UNIQUE INDEX IF NOT EXISTS "RegistrationRequest_pending_email_key"
ON "RegistrationRequest" ("email")
WHERE "status" = 'PENDING'::"RegistrationStatus";
