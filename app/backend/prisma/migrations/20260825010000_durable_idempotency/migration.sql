-- Legacy rows cannot be safely assigned a public fingerprint or trusted as
-- completed durable workflows. They have a short TTL, so this migration
-- deliberately expires them by replacing only the idempotency table.
-- No registration, account, file, schedule, session, or notification table is touched.
PRAGMA foreign_keys=OFF;

DROP TABLE "IdempotencyRecord";

CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "resourceId" TEXT,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
CREATE INDEX "IdempotencyRecord_status_updatedAt_idx" ON "IdempotencyRecord"("status", "updatedAt");
CREATE INDEX "IdempotencyRecord_resourceId_idx" ON "IdempotencyRecord"("resourceId");
CREATE UNIQUE INDEX "IdempotencyRecord_scope_fingerprintHash_keyHash_key" ON "IdempotencyRecord"("scope", "fingerprintHash", "keyHash");

PRAGMA foreign_keys=ON;
