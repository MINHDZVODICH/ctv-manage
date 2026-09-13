import { prisma } from '../src/shared/prisma.js';

async function audit() {
  console.log('Running pre-migration domain audit...');

  const invalidRoles = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "role" FROM "Account" WHERE "role" NOT IN ('ADMIN', 'CTV')`,
  );
  if (invalidRoles.length > 0)
    throw new Error(`Invalid Account roles: ${JSON.stringify(invalidRoles)}`);

  const invalidAccStatus = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "status" FROM "Account" WHERE "status" NOT IN ('ACTIVE', 'DISABLED')`,
  );
  if (invalidAccStatus.length > 0)
    throw new Error(`Invalid Account status: ${JSON.stringify(invalidAccStatus)}`);

  const invalidRegStatus = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "status" FROM "RegistrationRequest" WHERE "status" NOT IN ('PENDING', 'APPROVED', 'REJECTED')`,
  );
  if (invalidRegStatus.length > 0)
    throw new Error(`Invalid RegistrationRequest status: ${JSON.stringify(invalidRegStatus)}`);

  const invalidFileStates = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "state" FROM "FileAsset" WHERE "state" NOT IN ('STAGED', 'ACTIVE', 'QUARANTINED', 'DELETED')`,
  );
  if (invalidFileStates.length > 0)
    throw new Error(`Invalid FileAsset state: ${JSON.stringify(invalidFileStates)}`);

  const invalidReqCats = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "category" FROM "RegistrationRequestFile" WHERE "category" NOT IN ('AVATAR', 'CCCD_FRONT', 'CCCD_BACK', 'CV')`,
  );
  if (invalidReqCats.length > 0)
    throw new Error(
      `Invalid RegistrationRequestFile categories: ${JSON.stringify(invalidReqCats)}`,
    );

  const invalidAccCats = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "category" FROM "AccountFile" WHERE "category" NOT IN ('AVATAR', 'CCCD_FRONT', 'CCCD_BACK', 'CV')`,
  );
  if (invalidAccCats.length > 0)
    throw new Error(`Invalid AccountFile categories: ${JSON.stringify(invalidAccCats)}`);

  const invalidSchedRooms = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "roomCode" FROM "Schedule" WHERE "roomCode" NOT IN ('ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4')`,
  );
  if (invalidSchedRooms.length > 0)
    throw new Error(`Invalid Schedule roomCode: ${JSON.stringify(invalidSchedRooms)}`);

  const invalidShiftPeriods = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "period" FROM "Shift" WHERE "period" NOT IN ('MORNING', 'AFTERNOON')`,
  );
  if (invalidShiftPeriods.length > 0)
    throw new Error(`Invalid Shift periods: ${JSON.stringify(invalidShiftPeriods)}`);

  const invalidShiftWeekdays = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "weekday" FROM "Shift" WHERE "weekday" < 1 OR "weekday" > 5`,
  );
  if (invalidShiftWeekdays.length > 0)
    throw new Error(`Invalid Shift weekdays: ${JSON.stringify(invalidShiftWeekdays)}`);

  const invalidHistPeriods = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "period" FROM "History" WHERE "period" NOT IN ('MORNING', 'AFTERNOON')`,
  );
  if (invalidHistPeriods.length > 0)
    throw new Error(`Invalid History periods: ${JSON.stringify(invalidHistPeriods)}`);

  const invalidHistRooms = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "roomCode" FROM "History" WHERE "roomCode" NOT IN ('ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4')`,
  );
  if (invalidHistRooms.length > 0)
    throw new Error(`Invalid History roomCodes: ${JSON.stringify(invalidHistRooms)}`);

  const invalidHistStatus = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "status" FROM "History" WHERE "status" NOT IN ('COMPLETED', 'ACTIVE', 'DISABLED')`,
  );
  if (invalidHistStatus.length > 0)
    throw new Error(`Invalid History status: ${JSON.stringify(invalidHistStatus)}`);

  const invalidSnapStatus = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "status" FROM "SnapshotRun" WHERE "status" NOT IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'MISSED')`,
  );
  if (invalidSnapStatus.length > 0)
    throw new Error(`Invalid SnapshotRun status: ${JSON.stringify(invalidSnapStatus)}`);

  const invalidRateScopes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT "scope" FROM "RateLimitWindow" WHERE "scope" NOT IN ('LOGIN_IP', 'LOGIN_ACCOUNT', 'REGISTRATION_IP', 'UPLOAD_ACCOUNT')`,
  );
  if (invalidRateScopes.length > 0)
    throw new Error(`Invalid RateLimitWindow scopes: ${JSON.stringify(invalidRateScopes)}`);

  console.log('✓ All database records adhere to fixed domain definitions.');
}

audit()
  .catch((e) => {
    console.error('Audit failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
