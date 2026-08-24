-- Baseline for the schema shipped by Task 3 commit 5172cf0.
-- Existing databases at that schema must mark this migration applied before deploy:
-- prisma migrate resolve --applied 20260825000000_parent_schema_baseline

CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "ctvCode" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "address" TEXT,
    "adminNotes" TEXT,
    "joinedAt" DATETIME,
    "lastLoginAt" DATETIME,
    "passwordChangedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "approvedAccountId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegistrationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegistrationRequest_approvedAccountId_fkey" FOREIGN KEY ("approvedAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'STAGED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

CREATE TABLE "RegistrationRequestFile" (
    "requestId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    PRIMARY KEY ("requestId", "fileId"),
    CONSTRAINT "RegistrationRequestFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegistrationRequestFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AccountFile" (
    "accountId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    PRIMARY KEY ("accountId", "fileId"),
    CONSTRAINT "AccountFile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ScheduleRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "timeZone" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "workContent" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelledAt" DATETIME,
    CONSTRAINT "ScheduleRegistration_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SchedulePatternSlot" (
    "registrationId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    PRIMARY KEY ("registrationId", "weekday", "period"),
    CONSTRAINT "SchedulePatternSlot_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ScheduleRegistration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "workContent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShiftAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShiftAssignment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ScheduleRegistration" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");
CREATE UNIQUE INDEX "Account_ctvCode_key" ON "Account"("ctvCode");
CREATE INDEX "Account_status_deletedAt_idx" ON "Account"("status", "deletedAt");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_accountId_revokedAt_expiresAt_idx" ON "Session"("accountId", "revokedAt", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "RegistrationRequest_approvedAccountId_key" ON "RegistrationRequest"("approvedAccountId");
CREATE INDEX "RegistrationRequest_status_submittedAt_idx" ON "RegistrationRequest"("status", "submittedAt");
CREATE INDEX "RegistrationRequest_email_idx" ON "RegistrationRequest"("email");
CREATE INDEX "RegistrationRequest_reviewedById_reviewedAt_idx" ON "RegistrationRequest"("reviewedById", "reviewedAt");
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");
CREATE INDEX "FileAsset_state_createdAt_idx" ON "FileAsset"("state", "createdAt");
CREATE INDEX "FileAsset_sha256_idx" ON "FileAsset"("sha256");
CREATE INDEX "AccountFile_accountId_category_deletedAt_idx" ON "AccountFile"("accountId", "category", "deletedAt");
CREATE INDEX "ScheduleRegistration_accountId_status_startDate_endDate_idx" ON "ScheduleRegistration"("accountId", "status", "startDate", "endDate");
CREATE INDEX "Shift_workDate_status_idx" ON "Shift"("workDate", "status");
CREATE UNIQUE INDEX "Shift_workDate_period_key" ON "Shift"("workDate", "period");
CREATE INDEX "ShiftAssignment_accountId_status_idx" ON "ShiftAssignment"("accountId", "status");
CREATE INDEX "ShiftAssignment_registrationId_status_idx" ON "ShiftAssignment"("registrationId", "status");
CREATE UNIQUE INDEX "ShiftAssignment_shiftId_accountId_key" ON "ShiftAssignment"("shiftId", "accountId");
CREATE UNIQUE INDEX "ShiftAssignment_registrationId_shiftId_key" ON "ShiftAssignment"("registrationId", "shiftId");
CREATE INDEX "Notification_accountId_readAt_createdAt_idx" ON "Notification"("accountId", "readAt", "createdAt");
CREATE UNIQUE INDEX "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
