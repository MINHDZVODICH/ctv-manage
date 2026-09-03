import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

process.env.DATABASE_URL ??= 'file:./dev.db';

const prisma = new PrismaClient();

const ROOM_CODES = ['ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4'] as const;
const PERIODS = ['MORNING', 'AFTERNOON'] as const;

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

function sampleDistinct<T>(arr: readonly T[] | T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function cleanDatabase() {
  console.log('🧹 Cleaning database before seeding...');
  await prisma.workHistory.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedulePatternSlot.deleteMany();
  await prisma.scheduleRegistration.deleteMany();
  await prisma.accountFile.deleteMany();
  await prisma.registrationRequestFile.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.registrationRequest.deleteMany();
  await prisma.account.deleteMany();
}

async function main() {
  await cleanDatabase();

  console.log('🌱 Starting database seeding...');

  // Hash passwords
  const adminPasswordHash = await argon2.hash('Admin@123456');
  const ctvPasswordHash = await argon2.hash('Ctv@123456');
  const acceptancePasswordHash = await argon2.hash('Test@123456');

  // 1. Seed 1 Main Admin Account
  console.log('👤 Seeding Admin account...');
  const mainAdmin = await prisma.account.create({
    data: {
      email: 'admin@amst.gov.vn',
      passwordHash: adminPasswordHash,
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

  // 2. Seed 5 Main CTV Accounts
  console.log('👥 Seeding 5 CTV accounts...');
  const ctvDataList = [
    {
      email: 'ctv.an@amst.gov.vn',
      displayName: 'Nguyễn Văn An',
      ctvCode: 'CTV-001',
      phone: '0912000001',
      gender: 'Nam',
      dateOfBirth: new Date('1998-03-12T00:00:00.000Z'),
      address: 'Cầu Giấy, Hà Nội',
      adminNotes: 'CTV xuất sắc chuyên môn Phần mềm & Hệ thống',
    },
    {
      email: 'ctv.bich@amst.gov.vn',
      displayName: 'Trần Thị Bích',
      ctvCode: 'CTV-002',
      phone: '0912000002',
      gender: 'Nữ',
      dateOfBirth: new Date('1999-07-24T00:00:00.000Z'),
      address: 'Đống Đa, Hà Nội',
      adminNotes: 'CTV phụ trách Kỹ thuật Mạng',
    },
    {
      email: 'ctv.cuong@amst.gov.vn',
      displayName: 'Lê Hoàng Cường',
      ctvCode: 'CTV-003',
      phone: '0912000003',
      gender: 'Nam',
      dateOfBirth: new Date('1997-11-05T00:00:00.000Z'),
      address: 'Nam Từ Liêm, Hà Nội',
      adminNotes: 'CTV Điện tử - Tự động hóa',
    },
    {
      email: 'ctv.dung@amst.gov.vn',
      displayName: 'Phạm Thị Dung',
      ctvCode: 'CTV-004',
      phone: '0912000004',
      gender: 'Nữ',
      dateOfBirth: new Date('2000-01-18T00:00:00.000Z'),
      address: 'Hai Bà Trưng, Hà Nội',
      adminNotes: 'CTV Nghiên cứu Dữ liệu',
    },
    {
      email: 'ctv.em@amst.gov.vn',
      displayName: 'Hoàng Văn Em',
      ctvCode: 'CTV-005',
      phone: '0912000005',
      gender: 'Nam',
      dateOfBirth: new Date('1998-09-30T00:00:00.000Z'),
      address: 'Thanh Xuân, Hà Nội',
      adminNotes: 'CTV An toàn thông tin',
    },
  ];

  const ctvAccounts = [];
  for (const ctvInfo of ctvDataList) {
    const acc = await prisma.account.create({
      data: {
        ...ctvInfo,
        passwordHash: ctvPasswordHash,
        role: 'CTV',
        status: 'ACTIVE',
      },
    });
    ctvAccounts.push(acc);
  }

  // 3. Seed 5 Acceptance Accounts
  console.log('🧪 Seeding 5 Acceptance accounts...');
  const acceptanceDataList = [
    {
      email: 'admin.acceptance@ctv.local',
      displayName: 'Admin Acceptance',
      ctvCode: 'ADMIN-ACCEPTANCE',
      role: 'ADMIN',
      status: 'ACTIVE',
      phone: '0900000000',
      gender: 'Nam',
      address: 'Khu Kiểm thử Chấp nhận',
    },
    {
      email: 'ctv.active@ctv.local',
      displayName: 'CTV Active Acceptance',
      ctvCode: 'CTV-ACCEPTANCE-001',
      role: 'CTV',
      status: 'ACTIVE',
      phone: '0900000001',
      gender: 'Nam',
      address: 'Hà Nội',
    },
    {
      email: 'ctv.other@ctv.local',
      displayName: 'CTV Other Acceptance',
      ctvCode: 'CTV-ACCEPTANCE-002',
      role: 'CTV',
      status: 'ACTIVE',
      phone: '0900000002',
      gender: 'Nữ',
      address: 'Đà Nẵng',
    },
    {
      email: 'ctv.disabled@ctv.local',
      displayName: 'CTV Disabled Acceptance',
      ctvCode: 'CTV-ACCEPTANCE-003',
      role: 'CTV',
      status: 'DISABLED',
      phone: '0900000003',
      gender: 'Nam',
      address: 'Hải Phòng',
    },
    {
      email: 'ctv.acceptance5@ctv.local',
      displayName: 'CTV Reviewer Acceptance',
      ctvCode: 'CTV-ACCEPTANCE-004',
      role: 'CTV',
      status: 'ACTIVE',
      phone: '0900000004',
      gender: 'Nữ',
      address: 'TP Hồ Chí Minh',
    },
  ];

  const acceptanceAccounts = [];
  for (const accInfo of acceptanceDataList) {
    const acc = await prisma.account.create({
      data: {
        ...accInfo,
        passwordHash: acceptancePasswordHash,
      },
    });
    acceptanceAccounts.push(acc);
  }

  // Combine all active CTVs to seed schedules & histories
  const allActiveCtvs = [
    ...ctvAccounts,
    ...acceptanceAccounts.filter((a) => a.role === 'CTV' && a.status === 'ACTIVE'),
  ];

  console.log(`📅 Generating schedules and work histories for ${allActiveCtvs.length} CTVs...`);

  const now = new Date();
  const currentMonday = getMonday(now);
  const registrationEndDate = addDays(currentMonday, 30);

  // Define possible pattern slots combinations
  const allPossibleSlots: { weekday: number; period: 'MORNING' | 'AFTERNOON' }[] = [];
  for (let weekday = 1; weekday <= 5; weekday++) {
    for (const period of PERIODS) {
      allPossibleSlots.push({ weekday, period });
    }
  }

  for (let i = 0; i < allActiveCtvs.length; i++) {
    const ctv = allActiveCtvs[i];
    const assignedRoom = ROOM_CODES[i % ROOM_CODES.length];

    // Pick 3-5 distinct slots for weekly schedule
    const slotCount = 3 + (i % 3); // 3 to 5 slots
    const chosenSlots = sampleDistinct(allPossibleSlots, slotCount);

    // Create ScheduleRegistration
    const registration = await prisma.scheduleRegistration.create({
      data: {
        accountId: ctv.id,
        startDate: currentMonday,
        endDate: registrationEndDate,
        roomCode: assignedRoom,
        status: 'ACTIVE',
        version: 1,
        patternSlots: {
          create: chosenSlots.map((s) => ({
            weekday: s.weekday,
            period: s.period,
          })),
        },
      },
    });

    // Populate current & future shifts and shift assignments from start to end date
    for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
      const targetDate = addDays(currentMonday, dayOffset);
      const jsDay = targetDate.getUTCDay();
      const weekdayIso = jsDay === 0 ? 7 : jsDay;

      // Only Monday - Friday
      if (weekdayIso >= 1 && weekdayIso <= 5) {
        const matchingSlots = chosenSlots.filter((s) => s.weekday === weekdayIso);

        for (const slot of matchingSlots) {
          // Find or create Shift
          const shift = await prisma.shift.upsert({
            where: {
              workDate_period: {
                workDate: targetDate,
                period: slot.period,
              },
            },
            create: {
              workDate: targetDate,
              period: slot.period,
            },
            update: {},
          });

          // Create ShiftAssignment
          await prisma.shiftAssignment.upsert({
            where: {
              shiftId_accountId: {
                shiftId: shift.id,
                accountId: ctv.id,
              },
            },
            create: {
              shiftId: shift.id,
              accountId: ctv.id,
              registrationId: registration.id,
              roomCode: assignedRoom,
              status: 'ACTIVE',
            },
            update: {
              status: 'ACTIVE',
              roomCode: assignedRoom,
            },
          });
        }
      }
    }

    // Generate WorkHistory over the past 4 weeks (28 days back)
    for (let pastDays = 28; pastDays >= 1; pastDays--) {
      const pastDate = addDays(currentMonday, -pastDays);
      const jsDay = pastDate.getUTCDay();
      const weekdayIso = jsDay === 0 ? 7 : jsDay;

      // Work occurs Monday - Friday
      if (weekdayIso >= 1 && weekdayIso <= 5) {
        // Probabilistic work history
        if ((pastDays + i) % 3 !== 0) {
          const periodsToWork: ('MORNING' | 'AFTERNOON')[] = [];
          if ((pastDays + i) % 2 === 0) {
            periodsToWork.push('MORNING');
          } else if ((pastDays + i) % 5 === 0) {
            periodsToWork.push('MORNING', 'AFTERNOON');
          } else {
            periodsToWork.push('AFTERNOON');
          }

          for (const period of periodsToWork) {
            await prisma.workHistory.upsert({
              where: {
                accountId_workDate_period: {
                  accountId: ctv.id,
                  workDate: pastDate,
                  period,
                },
              },
              create: {
                accountId: ctv.id,
                workDate: pastDate,
                period,
                roomCode: assignedRoom,
                status: 'COMPLETED',
                recordedAt: new Date(pastDate.getTime() + 17 * 3600 * 1000),
              },
              update: {},
            });
          }
        }
      }
    }
  }

  // 4. Seed sample Registration Requests
  console.log('📝 Seeding sample Registration Requests for review...');
  await prisma.registrationRequest.createMany({
    data: [
      {
        email: 'applicant.hoa@gmail.com',
        displayName: 'Vũ Thị Hoa',
        phone: '0933112233',
        gender: 'Nữ',
        dateOfBirth: new Date('2001-04-10T00:00:00.000Z'),
        address: 'Hà Đông, Hà Nội',
        status: 'PENDING',
      },
      {
        email: 'applicant.khoa@gmail.com',
        displayName: 'Đặng Đăng Khoa',
        phone: '0944223344',
        gender: 'Nam',
        dateOfBirth: new Date('1999-12-01T00:00:00.000Z'),
        address: 'Hoàng Mai, Hà Nội',
        status: 'PENDING',
      },
      {
        email: 'applicant.lan@gmail.com',
        displayName: 'Ngô Ngọc Lan',
        phone: '0955334455',
        gender: 'Nữ',
        dateOfBirth: new Date('2002-08-19T00:00:00.000Z'),
        address: 'Tây Hồ, Hà Nội',
        status: 'REJECTED',
        rejectionReason: 'Hồ sơ chưa cung cấp đầy đủ thông tin căn cước công dân.',
        reviewedById: mainAdmin.id,
        reviewedAt: new Date(),
      },
    ],
  });

  console.log('\n======================================================');
  console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log('\n🔑 ACCOUNTS AVAILABLE:');
  console.log('------------------------------------------------------');
  console.log('👑 1 Admin Account (Password: Admin@123456):');
  console.log(`   - ${mainAdmin.email} (${mainAdmin.displayName})`);
  console.log('\n💼 5 CTV Accounts (Password: Ctv@123456):');
  ctvAccounts.forEach((c) => {
    console.log(`   - ${c.email} [${c.ctvCode}] - ${c.displayName}`);
  });
  console.log('\n🧪 5 Acceptance Accounts (Password: Test@123456):');
  acceptanceAccounts.forEach((a) => {
    console.log(`   - ${a.email} [${a.role}] (${a.status}) - ${a.displayName}`);
  });
  console.log('\n✨ All CTVs have active schedule registrations, shift assignments, and historical records.');
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
