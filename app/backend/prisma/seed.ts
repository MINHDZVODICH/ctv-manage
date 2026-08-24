import argon2 from 'argon2';
import { AccountRole, AccountStatus } from '@prisma/client';
import { prisma } from '../src/shared/prisma.js';

async function main(): Promise<void> {
  const passwordHash = await argon2.hash('ChangeMe123!');
  await prisma.account.upsert({
    where: { email: 'admin@ctv.local' },
    create: {
      email: 'admin@ctv.local',
      passwordHash,
      role: AccountRole.ADMIN,
      status: AccountStatus.ACTIVE,
      mustChangePassword: true,
      displayName: 'Quản trị viên',
    },
    update: {},
  });
}

main()
  .finally(() => prisma.$disconnect());
