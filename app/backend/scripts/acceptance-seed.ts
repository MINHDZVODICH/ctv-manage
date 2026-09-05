import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
  await prisma.history.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.accountFile.deleteMany();
  await prisma.registrationRequestFile.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.registrationRequest.deleteMany();
  await prisma.account.deleteMany();
}

async function main() {
  await cleanDatabase();
  const passwordHash = await argon2.hash('Test@123456');

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
    ],
  });

  await prisma.registrationRequest.create({
    data: {
      email: 'pending.acceptance@ctv.local',
      passwordHash,
      displayName: 'Hồ sơ chờ duyệt',
      phone: '0900000004',
      status: 'PENDING',
    },
  });

  console.log('Acceptance database seeded for Playwright.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
