import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

export interface SeedDemoOptions {
  nodeEnv?: string;
  databaseUrl?: string;
  demoPassword?: string;
  argv?: string[];
  prisma?: any;
}

export function extractDatabaseName(urlString?: string): string {
  if (!urlString) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  const url = new URL(urlString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name.');
  }
  return databaseName;
}

export function validateDemoSeedEnvironment(env: {
  nodeEnv?: string;
  databaseUrl?: string;
  demoPassword?: string;
}): { databaseName: string; demoPassword: string } {
  const nodeEnv = env.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv !== 'development') {
    throw new Error(
      `Refusing to seed demo data in "${nodeEnv}" environment. Demo seed requires NODE_ENV="development".`,
    );
  }

  const databaseUrl = env.databaseUrl ?? process.env.DATABASE_URL;
  const databaseName = extractDatabaseName(databaseUrl);
  if (!/(^|[_-])(dev|demo)($|[_-])/.test(databaseName)) {
    throw new Error(
      `Refusing to seed database "${databaseName}" because its name does not contain a "dev" or "demo" marker.`,
    );
  }

  const demoPassword = env.demoPassword ?? process.env.DEMO_PASSWORD;
  if (!demoPassword || !demoPassword.trim()) {
    throw new Error('DEMO_PASSWORD environment variable is required.');
  }

  return { databaseName, demoPassword };
}

export function assertResetAllowed(argv: string[] = process.argv): void {
  if (!argv.includes('--reset')) {
    throw new Error('Refusing to truncate/delete tables: --reset flag is required.');
  }
}

export async function cleanDemoDatabase(
  prisma: any,
  argv: string[] = process.argv,
): Promise<void> {
  assertResetAllowed(argv);
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

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d);
  res.setUTCDate(res.getUTCDate() + days);
  return res;
}

export async function runDemoSeed(options: SeedDemoOptions = {}): Promise<void> {
  const { demoPassword } = validateDemoSeedEnvironment(options);
  const argv = options.argv ?? process.argv;
  const isInternalClient = !options.prisma;
  const prisma = options.prisma ?? new PrismaClient();

  try {
    if (argv.includes('--reset')) {
      console.log('🧹 Clearing existing demo database data (--reset specified)...');
      await cleanDemoDatabase(prisma, argv);
    }

    console.log('🌱 Starting guarded demo data seeding...');
    const passwordHash = await argon2.hash(demoPassword);

    // 1. Admin account
    const adminAccount = await prisma.account.create({
      data: {
        email: 'admin@amst.gov.vn',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        displayName: 'Quản trị viên Hệ thống',
        phone: '0988123456',
        ctvCode: 'ADMIN-001',
        dateOfBirth: new Date('1988-06-15T00:00:00.000Z'),
        gender: 'Nam',
        address: 'Viện Khoa học và Công nghệ Quân sự, Hà Nội',
        adminNotes: 'Tài khoản Quản trị viên hệ thống trung tâm.',
      },
    });

    // 2. Active CTV accounts
    const ctvDataList = [
      {
        email: 'ctv1@amst.gov.vn',
        displayName: 'Nguyễn Văn An',
        ctvCode: 'CTV-001',
        phone: '0912000001',
        gender: 'Nam',
        dateOfBirth: new Date('1998-03-12T00:00:00.000Z'),
        address: 'Cầu Giấy, Hà Nội',
        adminNotes: 'CTV phụ trách Kỹ thuật Phần mềm & Hệ thống',
        roomCode: 'ROOM_1',
        shifts: [
          { weekday: 1, period: 'MORNING' as const },
          { weekday: 1, period: 'AFTERNOON' as const },
          { weekday: 3, period: 'MORNING' as const },
          { weekday: 5, period: 'AFTERNOON' as const },
        ],
      },
      {
        email: 'ctv2@amst.gov.vn',
        displayName: 'Trần Thị Bích',
        ctvCode: 'CTV-002',
        phone: '0912000002',
        gender: 'Nữ',
        dateOfBirth: new Date('1999-07-24T00:00:00.000Z'),
        address: 'Đống Đa, Hà Nội',
        adminNotes: 'CTV phụ trách Mạng & Viễn thông',
        roomCode: 'ROOM_2',
        shifts: [
          { weekday: 2, period: 'MORNING' as const },
          { weekday: 2, period: 'AFTERNOON' as const },
          { weekday: 4, period: 'MORNING' as const },
        ],
      },
      {
        email: 'ctv3@amst.gov.vn',
        displayName: 'Lê Hoàng Cường',
        ctvCode: 'CTV-003',
        phone: '0912000003',
        gender: 'Nam',
        dateOfBirth: new Date('1997-11-05T00:00:00.000Z'),
        address: 'Nam Từ Liêm, Hà Nội',
        adminNotes: 'CTV Điện tử & Tự động hóa',
        roomCode: 'ROOM_3',
        shifts: [
          { weekday: 1, period: 'AFTERNOON' as const },
          { weekday: 2, period: 'AFTERNOON' as const },
          { weekday: 4, period: 'AFTERNOON' as const },
          { weekday: 5, period: 'MORNING' as const },
        ],
      },
    ];

    const currentMonday = getMonday(new Date());

    for (const ctvInfo of ctvDataList) {
      const { roomCode, shifts, ...accountFields } = ctvInfo;
      const ctv = await prisma.account.create({
        data: {
          ...accountFields,
          passwordHash,
          role: 'CTV',
          status: 'ACTIVE',
        },
      });

      await prisma.schedule.create({
        data: {
          accountId: ctv.id,
          roomCode,
          version: 1,
          shifts: {
            create: shifts.map((s) => ({
              weekday: s.weekday,
              period: s.period,
            })),
          },
        },
      });

      // 4 weeks of past History
      for (let pastDays = 28; pastDays >= 1; pastDays--) {
        const pastDate = addDays(currentMonday, -pastDays);
        const jsDay = pastDate.getUTCDay();
        const weekdayIso = jsDay === 0 ? 7 : jsDay;

        const matchingShifts = shifts.filter((s) => s.weekday === weekdayIso);
        for (const shift of matchingShifts) {
          await prisma.history.upsert({
            where: {
              accountId_workDate_period: {
                accountId: ctv.id,
                workDate: pastDate,
                period: shift.period,
              },
            },
            create: {
              accountId: ctv.id,
              workDate: pastDate,
              period: shift.period,
              roomCode,
              status: 'COMPLETED',
              recordedAt: new Date(pastDate.getTime() + 17 * 3600 * 1000 + 30 * 60 * 1000),
            },
            update: {},
          });
        }
      }
    }

    // 3. Pending registrations
    await prisma.registrationRequest.createMany({
      data: [
        {
          email: 'choduyet1@gmail.com',
          displayName: 'Phạm Minh Đức',
          phone: '0933112233',
          gender: 'Nam',
          dateOfBirth: new Date('2001-05-15T00:00:00.000Z'),
          address: 'Thanh Xuân, Hà Nội',
          passwordHash,
          status: 'PENDING',
        },
        {
          email: 'choduyet2@gmail.com',
          displayName: 'Vũ Thị Hoa',
          phone: '0944223344',
          gender: 'Nữ',
          dateOfBirth: new Date('2002-08-20T00:00:00.000Z'),
          address: 'Hà Đông, Hà Nội',
          passwordHash,
          status: 'PENDING',
        },
        {
          email: 'choduyet3@gmail.com',
          displayName: 'Đặng Hoàng Long',
          phone: '0955334455',
          gender: 'Nam',
          dateOfBirth: new Date('2000-11-10T00:00:00.000Z'),
          address: 'Hai Bà Trưng, Hà Nội',
          passwordHash,
          status: 'PENDING',
        },
      ],
    });

    console.log('🎉 Demo seed completed successfully!');
    console.log(`👤 Admin: ${adminAccount.email}`);
    console.log('💼 Active CTV accounts: ctv1@amst.gov.vn, ctv2@amst.gov.vn, ctv3@amst.gov.vn');
    console.log('⏳ Pending accounts: choduyet1@gmail.com, choduyet2@gmail.com, choduyet3@gmail.com');
  } finally {
    if (isInternalClient) {
      await prisma.$disconnect();
    }
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Boolean(process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/seed-demo.ts'));

if (isDirectRun) {
  runDemoSeed().catch((error) => {
    console.error('❌ Demo seed failed:', error);
    process.exit(1);
  });
}
