import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const SHARED_PASSWORD = '12345678';

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

async function cleanDatabase() {
  console.log('🧹 Xóa sạch toàn bộ dữ liệu trong database ctv_manage...');
  await prisma.history.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.accountFile.deleteMany();
  await prisma.registrationRequestFile.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.registrationRequest.deleteMany();
  await prisma.account.deleteMany();
  console.log('✅ Đã xóa sạch toàn bộ dữ liệu cũ.');
}

async function main() {
  await cleanDatabase();

  console.log('🌱 Bắt đầu tạo mới dữ liệu mẫu (Seeding)...');

  // Hash mật khẩu chung 12345678
  const sharedPasswordHash = await argon2.hash(SHARED_PASSWORD);

  // 1. Tạo 1 Tài khoản Quản trị viên (Admin)
  console.log('👤 Tạo 1 tài khoản Admin...');
  const adminAccount = await prisma.account.create({
    data: {
      email: 'admin@amst.gov.vn',
      passwordHash: sharedPasswordHash,
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

  // 2. Tạo 3 Tài khoản CTV
  console.log('👥 Tạo 3 tài khoản CTV hoạt động...');
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

  const createdCtvs = [];
  const now = new Date();
  const currentMonday = getMonday(now);

  for (const ctvInfo of ctvDataList) {
    const { roomCode, shifts, ...accountFields } = ctvInfo;
    const ctv = await prisma.account.create({
      data: {
        ...accountFields,
        passwordHash: sharedPasswordHash,
        role: 'CTV',
        status: 'ACTIVE',
      },
    });

    createdCtvs.push({ ...ctv, roomCode, shifts });

    // Tạo Schedule & Shifts cho CTV
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

    // Tạo lịch sử làm việc (History) trong 4 tuần trước
    for (let pastDays = 28; pastDays >= 1; pastDays--) {
      const pastDate = addDays(currentMonday, -pastDays);
      const jsDay = pastDate.getUTCDay();
      const weekdayIso = jsDay === 0 ? 7 : jsDay;

      // Tìm xem ngày trong tuần đó CTV có ca trực hay không
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

  // 3. Tạo 3 Hồ sơ/Tài khoản đang chờ duyệt (RegistrationRequest PENDING)
  console.log('📝 Tạo 3 yêu cầu đăng ký đang chờ duyệt...');
  await prisma.registrationRequest.createMany({
    data: [
      {
        email: 'choduyet1@gmail.com',
        displayName: 'Phạm Minh Đức',
        phone: '0933112233',
        gender: 'Nam',
        dateOfBirth: new Date('2001-05-15T00:00:00.000Z'),
        address: 'Thanh Xuân, Hà Nội',
        passwordHash: sharedPasswordHash,
        status: 'PENDING',
      },
      {
        email: 'choduyet2@gmail.com',
        displayName: 'Vũ Thị Hoa',
        phone: '0944223344',
        gender: 'Nữ',
        dateOfBirth: new Date('2002-08-20T00:00:00.000Z'),
        address: 'Hà Đông, Hà Nội',
        passwordHash: sharedPasswordHash,
        status: 'PENDING',
      },
      {
        email: 'choduyet3@gmail.com',
        displayName: 'Đặng Hoàng Long',
        phone: '0955334455',
        gender: 'Nam',
        dateOfBirth: new Date('2000-11-10T00:00:00.000Z'),
        address: 'Hai Bà Trưng, Hà Nội',
        passwordHash: sharedPasswordHash,
        status: 'PENDING',
      },
    ],
  });

  console.log('\n======================================================');
  console.log('🎉 KHỞI TẠO DỮ LIỆU THÀNH CÔNG!');
  console.log('======================================================');
  console.log(`🔐 MẬT KHẨU CHUNG CHO TẤT CẢ TÀI KHOẢN: ${SHARED_PASSWORD}`);
  console.log('------------------------------------------------------');
  console.log('👑 1 TÀI KHOẢN ADMIN:');
  console.log(`   - Email: ${adminAccount.email} | Tên: ${adminAccount.displayName} | Mã: ${adminAccount.ctvCode}`);
  console.log('\n💼 3 TÀI KHOẢN CTV HOẠT ĐỘNG:');
  createdCtvs.forEach((c) => {
    console.log(`   - Email: ${c.email} | Tên: ${c.displayName} | Mã: ${c.ctvCode} | Phòng: ${c.roomCode}`);
  });
  console.log('\n⏳ 3 TÀI KHOẢN ĐANG CHỜ DUYỆT (PENDING):');
  console.log('   - Email: choduyet1@gmail.com | Tên: Phạm Minh Đức | SĐT: 0933112233');
  console.log('   - Email: choduyet2@gmail.com | Tên: Vũ Thị Hoa    | SĐT: 0944223344');
  console.log('   - Email: choduyet3@gmail.com | Tên: Đặng Hoàng Long | SĐT: 0955334455');
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi khởi tạo dữ liệu mẫu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
