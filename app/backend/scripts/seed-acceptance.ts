import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { extractDatabaseName } from './seed-demo';

export interface SeedAcceptanceOptions {
  nodeEnv?: string;
  databaseUrl?: string;
  testPassword?: string;
  prisma?: any;
}

export function validateAcceptanceSeedEnvironment(env: {
  nodeEnv?: string;
  databaseUrl?: string;
}): { databaseName: string; databaseUrl: string } {
  const nodeEnv = env.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv !== 'test') {
    throw new Error(
      `Refusing to run acceptance seed in "${nodeEnv}" environment. Acceptance seed requires NODE_ENV="test".`,
    );
  }

  const databaseUrl = env.databaseUrl ?? process.env.DATABASE_TEST_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Database connection URL is not provided.');
  }
  const databaseName = extractDatabaseName(databaseUrl);
  if (!/(^|[_-])test($|[_-])/.test(databaseName)) {
    throw new Error(
      `Refusing to run acceptance seed against database "${databaseName}" because its name does not contain the "test" marker.`,
    );
  }

  return { databaseName, databaseUrl };
}

export async function cleanAcceptanceDatabase(prisma: any): Promise<void> {
  await prisma.history.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.accountFile.deleteMany();
  await prisma.registrationRequestFile.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.registrationRequest.deleteMany();
  await prisma.account.deleteMany();
  if (prisma.snapshotRun && typeof prisma.snapshotRun.deleteMany === 'function') {
    await prisma.snapshotRun.deleteMany();
  }
  if (prisma.rateLimitWindow && typeof prisma.rateLimitWindow.deleteMany === 'function') {
    await prisma.rateLimitWindow.deleteMany();
  }
}

export async function runAcceptanceSeed(options: SeedAcceptanceOptions = {}): Promise<void> {
  const { databaseUrl } = validateAcceptanceSeedEnvironment(options);
  process.env.DATABASE_URL = databaseUrl;

  const isInternalClient = !options.prisma;
  const prisma =
    options.prisma ??
    new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  const testPassword = options.testPassword ?? process.env.TEST_PASSWORD ?? 'Test@123456';

  try {
    await cleanAcceptanceDatabase(prisma);
    const passwordHash = await argon2.hash(testPassword);

    await prisma.account.createMany({
      data: [
        {
          email: 'admin.acceptance@ctv.local',
          passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
          displayName: 'Admin Acceptance',
          ctvCode: 'ADMIN-ACCEPTANCE',
        },
        {
          email: 'ctv.active@ctv.local',
          passwordHash,
          role: 'CTV',
          status: 'ACTIVE',
          displayName: 'CTV Active',
          phone: '0900000001',
          ctvCode: 'CTV-ACCEPTANCE-001',
        },
        {
          email: 'ctv.other@ctv.local',
          passwordHash,
          role: 'CTV',
          status: 'ACTIVE',
          displayName: 'CTV Other',
          phone: '0900000002',
          ctvCode: 'CTV-ACCEPTANCE-002',
        },
        {
          email: 'ctv.disabled@ctv.local',
          passwordHash,
          role: 'CTV',
          status: 'DISABLED',
          displayName: 'CTV Disabled',
          phone: '0900000003',
          ctvCode: 'CTV-ACCEPTANCE-003',
        },
        {
          email: 'vu.thi.hoa@ctv.local',
          passwordHash,
          role: 'CTV',
          status: 'ACTIVE',
          displayName: 'Vũ Thị Hoa',
          phone: '0900000005',
          ctvCode: 'CTV-ACCEPTANCE-005',
        },
      ],
    });

    await prisma.registrationRequest.create({
      data: {
        email: 'approve.candidate@ctv.local',
        passwordHash,
        displayName: 'Hồ sơ chờ duyệt',
        phone: '0900000004',
        status: 'PENDING',
      },
    });

    await prisma.registrationRequest.create({
      data: {
        email: 'pending.acceptance@ctv.local',
        passwordHash,
        displayName: 'Ứng viên chờ duyệt',
        phone: '0900000006',
        status: 'PENDING',
      },
    });

    console.log('Acceptance database seeded for Playwright.');
  } finally {
    if (isInternalClient) {
      await prisma.$disconnect();
    }
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Boolean(
    process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/seed-acceptance.ts'),
  );

if (isDirectRun) {
  runAcceptanceSeed().catch((error) => {
    console.error('❌ Acceptance seed failed:', error);
    process.exit(1);
  });
}
