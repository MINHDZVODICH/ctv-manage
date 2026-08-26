import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@ctv.local';
  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin already exists:', email);
    return;
  }
  const passwordHash = await argon2.hash('Admin@123456');
  await prisma.account.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      displayName: 'Administrator',
      ctvCode: 'ADMIN001',
    },
  });
  console.log('Seeded admin:', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
