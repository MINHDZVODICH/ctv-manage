-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "ctvCode" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "adminNotes" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "approvedAccountId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequestFile" (
    "requestId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "RegistrationRequestFile_pkey" PRIMARY KEY ("requestId","fileId")
);

-- CreateTable
CREATE TABLE "AccountFile" (
    "accountId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AccountFile_pkey" PRIMARY KEY ("accountId","fileId")
);

-- CreateTable
CREATE TABLE "ScheduleRegistration" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "roomCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePatternSlot" (
    "registrationId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "period" TEXT NOT NULL,

    CONSTRAINT "SchedulePatternSlot_pkey" PRIMARY KEY ("registrationId","weekday","period")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkHistory" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "period" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "sourceAssignmentId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");
CREATE UNIQUE INDEX "Account_ctvCode_key" ON "Account"("ctvCode");
CREATE INDEX "Account_status_deletedAt_idx" ON "Account"("status", "deletedAt");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_accountId_revokedAt_expiresAt_idx" ON "Session"("accountId", "revokedAt", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "RegistrationRequest_status_submittedAt_idx" ON "RegistrationRequest"("status", "submittedAt" DESC);
CREATE INDEX "RegistrationRequest_email_idx" ON "RegistrationRequest"("email");
CREATE INDEX "RegistrationRequest_reviewedById_reviewedAt_idx" ON "RegistrationRequest"("reviewedById", "reviewedAt");
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");
CREATE INDEX "FileAsset_state_createdAt_idx" ON "FileAsset"("state", "createdAt");
CREATE INDEX "FileAsset_sha256_idx" ON "FileAsset"("sha256");
CREATE UNIQUE INDEX "RegistrationRequestFile_requestId_category_key" ON "RegistrationRequestFile"("requestId", "category");
CREATE INDEX "AccountFile_accountId_category_deletedAt_idx" ON "AccountFile"("accountId", "category", "deletedAt");
CREATE INDEX "ScheduleRegistration_accountId_status_startDate_endDate_idx" ON "ScheduleRegistration"("accountId", "status", "startDate", "endDate");
CREATE UNIQUE INDEX "Shift_workDate_period_key" ON "Shift"("workDate", "period");
CREATE INDEX "ShiftAssignment_accountId_status_idx" ON "ShiftAssignment"("accountId", "status");
CREATE INDEX "ShiftAssignment_registrationId_status_idx" ON "ShiftAssignment"("registrationId", "status");
CREATE UNIQUE INDEX "ShiftAssignment_shiftId_accountId_key" ON "ShiftAssignment"("shiftId", "accountId");
CREATE UNIQUE INDEX "ShiftAssignment_registrationId_shiftId_key" ON "ShiftAssignment"("registrationId", "shiftId");
CREATE UNIQUE INDEX "WorkHistory_sourceAssignmentId_key" ON "WorkHistory"("sourceAssignmentId");
CREATE INDEX "WorkHistory_accountId_workDate_idx" ON "WorkHistory"("accountId", "workDate");
CREATE INDEX "WorkHistory_workDate_period_idx" ON "WorkHistory"("workDate", "period");
CREATE UNIQUE INDEX "WorkHistory_accountId_workDate_period_key" ON "WorkHistory"("accountId", "workDate", "period");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_approvedAccountId_fkey" FOREIGN KEY ("approvedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequestFile" ADD CONSTRAINT "RegistrationRequestFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequestFile" ADD CONSTRAINT "RegistrationRequestFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountFile" ADD CONSTRAINT "AccountFile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountFile" ADD CONSTRAINT "AccountFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleRegistration" ADD CONSTRAINT "ScheduleRegistration_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchedulePatternSlot" ADD CONSTRAINT "SchedulePatternSlot_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ScheduleRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ScheduleRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkHistory" ADD CONSTRAINT "WorkHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
