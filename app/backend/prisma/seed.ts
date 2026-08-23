import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning database and setting up fresh empty state ---');

  // 1. Clear all existing records
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedulePatternSlot.deleteMany();
  await prisma.scheduleRegistration.deleteMany();
  await prisma.accountSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.accountFile.deleteMany();
  await prisma.registrationRequestFile.deleteMany();
  await prisma.registrationRequest.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();

  console.log('✅ Cleared all database records.');

  // 2. Seed Skills catalogue
  const skillNames = [
    'React / TypeScript',
    'Node.js / Express',
    'Thiết kế UI/UX',
    'Quản lý cơ sở dữ liệu',
    'Kiểm thử phần mềm',
    'Bảo mật thông tin',
    'AI / Machine Learning',
  ];

  for (const name of skillNames) {
    await prisma.skill.create({ data: { name } });
  }
  console.log('✅ Initialized skill catalogue.');

  // 3. Seed ONLY default Administrator account (clean state, 0 CTVs, 0 shifts, 0 requests)
  const adminPassHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.account.create({
    data: {
      email: 'admin@vienkhcn.vn',
      displayName: 'Quản Trị Viên Hệ Thống',
      phone: '0901234567',
      role: 'Admin',
      status: 'Kích hoạt',
      ctvCode: 'ADM-001',
      dateOfBirth: '01/01/1985',
      gender: 'Nam',
      citizenId: '001085000001',
      address: 'Số 1 Hoàng Sâm, Cầu Giấy, Hà Nội',
      passwordHash: adminPassHash,
      adminNotes: 'Tài khoản Quản trị viên quản lý hệ thống.',
    },
  });

  console.log(`✅ Default Administrator created: ${admin.email} (password: admin123)`);
  console.log('✨ Database is now completely clean in 0-data state.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
