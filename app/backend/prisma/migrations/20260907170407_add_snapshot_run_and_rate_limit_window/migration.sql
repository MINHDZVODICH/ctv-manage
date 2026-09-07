-- CreateTable
CREATE TABLE "SnapshotRun" (
    "id" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SnapshotRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitWindow" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "identityDigest" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotRun_workDate_key" ON "SnapshotRun"("workDate");

-- CreateIndex
CREATE INDEX "SnapshotRun_status_nextAttemptAt_idx" ON "SnapshotRun"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "RateLimitWindow_expiresAt_idx" ON "RateLimitWindow"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitWindow_scope_identityDigest_windowStart_key" ON "RateLimitWindow"("scope", "identityDigest", "windowStart");
