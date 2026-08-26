import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const password = 'Test@123456';

async function resetDatabase() {
  await prisma.$transaction([
    prisma.shiftAssignment.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.schedulePatternSlot.deleteMany(),
    prisma.scheduleRegistration.deleteMany(),
    prisma.accountFile.deleteMany(),
    prisma.registrationRequestFile.deleteMany(),
    prisma.fileAsset.deleteMany(),
    prisma.session.deleteMany(),
    prisma.registrationRequest.deleteMany(),
    prisma.account.deleteMany(),
  ]);
}

async function createAccount(data: {
  email: string;
  displayName: string;
  role: 'ADMIN' | 'CTV';
  status?: 'ACTIVE' | 'DISABLED';
  ctvCode: string;
  phone?: string;
}) {
  return prisma.account.create({
    data: {
      ...data,
      status: data.status ?? 'ACTIVE',
      passwordHash: await argon2.hash(password),
    },
  });
}

async function main() {
  await resetDatabase();

  await createAccount({
    email: 'admin.acceptance@ctv.local',
    displayName: 'Admin Acceptance',
    role: 'ADMIN',
    ctvCode: 'ADMIN-E2E',
  });

  await createAccount({
    email: 'ctv.active@ctv.local',
    displayName: 'CTV Active',
    role: 'CTV',
    ctvCode: 'CTV-E2E-001',
    phone: '0900000001',
  });

  await createAccount({
    email: 'ctv.other@ctv.local',
    displayName: 'CTV Other',
    role: 'CTV',
    ctvCode: 'CTV-E2E-002',
    phone: '0900000002',
  });

  await createAccount({
    email: 'ctv.disabled@ctv.local',
    displayName: 'CTV Disabled',
    role: 'CTV',
    status: 'DISABLED',
    ctvCode: 'CTV-E2E-003',
  });

  await prisma.registrationRequest.create({
    data: {
      email: 'pending.acceptance@ctv.local',
      passwordHash: await argon2.hash(password),
      displayName: 'Hồ sơ chờ duyệt',
      phone: '0900000099',
      dateOfBirth: new Date('1998-01-01T00:00:00.000Z'),
      status: 'PENDING',
    },
  });

  console.log('Acceptance data ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
