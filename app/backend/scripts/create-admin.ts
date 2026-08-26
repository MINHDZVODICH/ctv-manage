import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function createAdmin() {
  // Read command line arguments or use defaults
  const args = process.argv.slice(2);
  const getArg = (flag: string, fallback: string) => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
    return fallback;
  };

  const email = getArg('--email', 'admin2@ctv.local');
  const password = getArg('--password', 'Admin@123456');
  const displayName = getArg('--name', 'Admin 2');
  const ctvCode = getArg('--code', 'ADMIN002');

  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    console.log(`[!] Tài khoản với email "${email}" đã tồn tại trên hệ thống.`);
    console.log(`    ID: ${existing.id}, DisplayName: ${existing.displayName}, Role: ${existing.role}`);
    return;
  }

  const passwordHash = await argon2.hash(password);
  const newAccount = await prisma.account.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      displayName,
      ctvCode,
    },
  });

  console.log(`[✓] Đã tạo thành công tài khoản Admin mới!`);
  console.log(`    - ID: ${newAccount.id}`);
  console.log(`    - Email: ${newAccount.email}`);
  console.log(`    - Display Name: ${newAccount.displayName}`);
  console.log(`    - Role: ${newAccount.role}`);
  console.log(`    - Status: ${newAccount.status}`);
  console.log(`    - CTV Code: ${newAccount.ctvCode}`);
  console.log(`    - Password: ${password}`);
}

createAdmin()
  .catch((e) => {
    console.error('[X] Lỗi khi tạo tài khoản admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
