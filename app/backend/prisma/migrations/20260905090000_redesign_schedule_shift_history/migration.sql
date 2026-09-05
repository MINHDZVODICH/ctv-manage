-- DropForeignKey
ALTER TABLE "SchedulePatternSlot" DROP CONSTRAINT IF EXISTS "SchedulePatternSlot_registrationId_fkey";
ALTER TABLE "ScheduleRegistration" DROP CONSTRAINT IF EXISTS "ScheduleRegistration_accountId_fkey";
ALTER TABLE "ShiftAssignment" DROP CONSTRAINT IF EXISTS "ShiftAssignment_accountId_fkey";
ALTER TABLE "ShiftAssignment" DROP CONSTRAINT IF EXISTS "ShiftAssignment_registrationId_fkey";
ALTER TABLE "ShiftAssignment" DROP CONSTRAINT IF EXISTS "ShiftAssignment_shiftId_fkey";
ALTER TABLE "WorkHistory" DROP CONSTRAINT IF EXISTS "WorkHistory_accountId_fkey";

-- DropTable
DROP TABLE IF EXISTS "SchedulePatternSlot";
DROP TABLE IF EXISTS "ScheduleRegistration";
DROP TABLE IF EXISTS "ShiftAssignment";
DROP TABLE IF EXISTS "WorkHistory";
DROP TABLE IF EXISTS "Shift";

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "scheduleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "period" TEXT NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("scheduleId","weekday","period")
);

-- CreateTable
CREATE TABLE "History" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "period" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "History_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_accountId_key" ON "Schedule"("accountId");

-- CreateIndex
CREATE INDEX "Schedule_accountId_idx" ON "Schedule"("accountId");

-- CreateIndex
CREATE INDEX "Shift_scheduleId_idx" ON "Shift"("scheduleId");

-- CreateIndex
CREATE INDEX "History_accountId_workDate_idx" ON "History"("accountId", "workDate");

-- CreateIndex
CREATE INDEX "History_workDate_period_idx" ON "History"("workDate", "period");

-- CreateIndex
CREATE UNIQUE INDEX "History_accountId_workDate_period_key" ON "History"("accountId", "workDate", "period");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "History" ADD CONSTRAINT "History_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
