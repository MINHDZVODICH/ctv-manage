import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

interface CTVSeedDef {
  email: string;
  password?: string;
  displayName: string;
  phone: string;
  ctvCode: string;
  dob: string;
  gender: string;
  address: string;
  roomCode: 'ROOM_1' | 'ROOM_2' | 'ROOM_3' | 'ROOM_4';
  adminNotes: string;
  slots: Array<{ weekday: number; period: 'MORNING' | 'AFTERNOON' }>;
}

const CTV_LIST: CTVSeedDef[] = [
  {
    email: 'nguyen.minh.tri@ctv.local',
    password: 'Password@123456',
    displayName: 'Nguyễn Minh Trí',
    phone: '0912345678',
    ctvCode: 'CTV-2026-001',
    dob: '1999-04-15',
    gender: 'Nam',
    address: '123 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    roomCode: 'ROOM_1',
    adminNotes: 'Cộng tác viên nhiệt tình, có kỹ năng giao tiếp tốt và hoàn thành xuất sắc các ca trực sáng.',
    slots: [
      { weekday: 1, period: 'MORNING' }, // Thứ 2 Sáng
      { weekday: 3, period: 'AFTERNOON' }, // Thứ 4 Chiều
      { weekday: 5, period: 'MORNING' }, // Thứ 6 Sáng
    ],
  },
  {
    email: 'le.thi.mai.huong@ctv.local',
    password: 'Password@123456',
    displayName: 'Lê Thị Mai Hương',
    phone: '0987654321',
    ctvCode: 'CTV-2026-002',
    dob: '1997-08-20',
    gender: 'Nữ',
    address: '45 Điện Biên Phủ, Phường 15, Quận Bình Thạnh, TP. Hồ Chí Minh',
    roomCode: 'ROOM_2',
    adminNotes: 'Thành thạo công việc văn phòng, hỗ trợ điều phối ca trực rất cẩn thận.',
    slots: [
      { weekday: 2, period: 'MORNING' }, // Thứ 3 Sáng
      { weekday: 4, period: 'MORNING' }, // Thứ 5 Sáng
      { weekday: 4, period: 'AFTERNOON' }, // Thứ 5 Chiều
    ],
  },
  {
    email: 'pham.hoang.long@ctv.local',
    password: 'Password@123456',
    displayName: 'Phạm Hoàng Long',
    phone: '0903112233',
    ctvCode: 'CTV-2026-003',
    dob: '2001-11-10',
    gender: 'Nam',
    address: '78 Lê Văn Sỹ, Phường 10, Quận 3, TP. Hồ Chí Minh',
    roomCode: 'ROOM_3',
    adminNotes: 'Sinh viên năm cuối năng động, phản ứng nhanh trong các ca hỗ trợ kỹ thuật.',
    slots: [
      { weekday: 1, period: 'AFTERNOON' }, // Thứ 2 Chiều
      { weekday: 2, period: 'AFTERNOON' }, // Thứ 3 Chiều
      { weekday: 3, period: 'MORNING' }, // Thứ 4 Sáng
    ],
  },
  {
    email: 'vu.thanh.hang@ctv.local',
    password: 'Password@123456',
    displayName: 'Vũ Thanh Hằng',
    phone: '0938998877',
    ctvCode: 'CTV-2026-004',
    dob: '1996-03-25',
    gender: 'Nữ',
    address: '12 Võ Thị Sáu, Phường Tân Định, Quận 1, TP. Hồ Chí Minh',
    roomCode: 'ROOM_1',
    adminNotes: 'Kinh nghiệm lâu năm, luôn đúng giờ và hòa đồng với mọi người.',
    slots: [
      { weekday: 3, period: 'MORNING' }, // Thứ 4 Sáng
      { weekday: 4, period: 'AFTERNOON' }, // Thứ 5 Chiều
      { weekday: 5, period: 'AFTERNOON' }, // Thứ 6 Chiều
    ],
  },
  {
    email: 'do.quang.huy@ctv.local',
    password: 'Password@123456',
    displayName: 'Đỗ Quang Huy',
    phone: '0971223344',
    ctvCode: 'CTV-2026-005',
    dob: '1998-09-05',
    gender: 'Nam',
    address: '250 Hoàng Văn Thụ, Phường 4, Quận Tân Bình, TP. Hồ Chí Minh',
    roomCode: 'ROOM_4',
    adminNotes: 'Chuyên môn tốt, có bằng lái xe B2 và chứng chỉ sơ cấp cứu.',
    slots: [
      { weekday: 1, period: 'MORNING' }, // Thứ 2 Sáng
      { weekday: 2, period: 'MORNING' }, // Thứ 3 Sáng
      { weekday: 5, period: 'MORNING' }, // Thứ 6 Sáng
    ],
  },
];

function getDatesInRange(startDateStr: string, endDateStr: string): Date[] {
  const dates: Date[] = [];
  const curr = new Date(startDateStr + 'T00:00:00.000Z');
  const end = new Date(endDateStr + 'T00:00:00.000Z');

  while (curr <= end) {
    dates.push(new Date(curr));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

function getIsoWeekday(d: Date): number {
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

async function seed5CTV() {
  console.log('=== Ghi dữ liệu 5 CTV, Lịch trình & Lịch sử vào DATABASE THẬT ===\n');

  const defaultPassword = 'Password@123456';

  const startDate = new Date('2026-06-01T00:00:00.000Z');
  const endDate = new Date('2026-12-31T00:00:00.000Z');
  const allWorkDates = getDatesInRange('2026-06-01', '2026-09-30');

  for (const ctv of CTV_LIST) {
    const rawPassword = ctv.password || defaultPassword;
    const passwordHash = await argon2.hash(rawPassword);
    console.log(`-> CTV: ${ctv.displayName} (${ctv.email}) | Mật khẩu: ${rawPassword}`);

    // 1. Tạo hoặc cập nhật Account
    let account = await prisma.account.findUnique({ where: { email: ctv.email } });
    if (!account) {
      // Find if ctvCode already used by another account
      let codeToUse = ctv.ctvCode;
      const codeExists = await prisma.account.findUnique({ where: { ctvCode: codeToUse } });
      if (codeExists) {
        codeToUse = `${ctv.ctvCode}-${Date.now().toString().slice(-4)}`;
      }

      account = await prisma.account.create({
        data: {
          email: ctv.email,
          passwordHash,
          displayName: ctv.displayName,
          role: 'CTV',
          status: 'ACTIVE',
          phone: ctv.phone,
          ctvCode: codeToUse,
          dateOfBirth: new Date(ctv.dob + 'T00:00:00.000Z'),
          gender: ctv.gender,
          address: ctv.address,
          adminNotes: ctv.adminNotes,
          joinedAt: startDate,
        },
      });
      console.log(`   [+] Đã tạo Account trong DB: ${account.id} (ctvCode: ${account.ctvCode})`);
    } else {
      let codeToUse = ctv.ctvCode;
      const codeExists = await prisma.account.findUnique({ where: { ctvCode: codeToUse } });
      if (codeExists && codeExists.id !== account.id) {
        codeToUse = account.ctvCode || `${ctv.ctvCode}-${Date.now().toString().slice(-4)}`;
      }

      account = await prisma.account.update({
        where: { id: account.id },
        data: {
          displayName: ctv.displayName,
          passwordHash,
          phone: ctv.phone,
          ctvCode: codeToUse,
          dateOfBirth: new Date(ctv.dob + 'T00:00:00.000Z'),
          gender: ctv.gender,
          address: ctv.address,
          adminNotes: ctv.adminNotes,
          status: 'ACTIVE',
        },
      });
      console.log(`   [*] Đã cập nhật Account trong DB: ${account.id} (ctvCode: ${account.ctvCode})`);
    }

    // 2. Tạo hoặc cập nhật ScheduleRegistration
    let registration = await prisma.scheduleRegistration.findFirst({
      where: { accountId: account.id, status: 'ACTIVE' },
    });

    if (!registration) {
      registration = await prisma.scheduleRegistration.create({
        data: {
          accountId: account.id,
          startDate,
          endDate,
          timeZone: 'Asia/Bangkok',
          roomCode: ctv.roomCode,
          status: 'ACTIVE',
          patternSlots: {
            create: ctv.slots.map((s) => ({
              weekday: s.weekday,
              period: s.period,
            })),
          },
        },
        include: { patternSlots: true },
      });
      console.log(`   [+] Đã tạo Đăng ký Lịch trình: ${registration.id} (${ctv.roomCode})`);
    } else {
      await prisma.schedulePatternSlot.deleteMany({ where: { registrationId: registration.id } });
      registration = await prisma.scheduleRegistration.update({
        where: { id: registration.id },
        data: {
          roomCode: ctv.roomCode,
          startDate,
          endDate,
          patternSlots: {
            create: ctv.slots.map((s) => ({
              weekday: s.weekday,
              period: s.period,
            })),
          },
        },
        include: { patternSlots: true },
      });
      console.log(`   [*] Đã cập nhật Lịch trình: ${registration.id}`);
    }

    // 3. Tạo Shifts và ShiftAssignments cho các tháng quá khứ và hiện tại (Lịch sử làm việc)
    let assignedCount = 0;
    const slotMap = new Map<number, Set<'MORNING' | 'AFTERNOON'>>();
    for (const s of ctv.slots) {
      if (!slotMap.has(s.weekday)) slotMap.set(s.weekday, new Set());
      slotMap.get(s.weekday)!.add(s.period);
    }

    for (const workDate of allWorkDates) {
      const weekday = getIsoWeekday(workDate);
      const periods = slotMap.get(weekday);
      if (!periods) continue;

      for (const period of periods) {
        let shift = await prisma.shift.findUnique({
          where: { workDate_period: { workDate, period } },
        });
        if (!shift) {
          shift = await prisma.shift.create({
            data: { workDate, period },
          });
        }

        const isPast = workDate < new Date('2026-08-20T00:00:00.000Z');
        const isOccasionalCancel = isPast && (workDate.getUTCDate() % 19 === 0);

        const assignmentData = {
          shiftId: shift.id,
          accountId: account.id,
          registrationId: registration.id,
          roomCode: ctv.roomCode,
          status: isOccasionalCancel ? 'CANCELLED' : 'ACTIVE',
          cancelledAt: isOccasionalCancel ? new Date(workDate.getTime() - 86400000) : null,
          cancellationReason: isOccasionalCancel ? 'Nghỉ phép có lý do cá nhân' : null,
        };

        const existingAssignment = await prisma.shiftAssignment.findUnique({
          where: { shiftId_accountId: { shiftId: shift.id, accountId: account.id } },
        });

        if (existingAssignment) {
          await prisma.shiftAssignment.update({
            where: { id: existingAssignment.id },
            data: assignmentData,
          });
        } else {
          await prisma.shiftAssignment.create({
            data: assignmentData,
          });
        }
        assignedCount++;
      }
    }

    console.log(`   [✓] Đã tạo ${assignedCount} ca làm việc vào bảng ShiftAssignments (Lịch sử từ 01/06/2026 -> 30/09/2026)`);
  }

  console.log('\n=== Hoàn tất! Toàn bộ 5 CTV và Lịch sử làm việc đã được lưu vào database thật (dev.db) ===');
  console.log('\n=== Danh sách tài khoản CTV & Mật khẩu đăng nhập ===');
  for (const ctv of CTV_LIST) {
    console.log(`- Email: ${ctv.email.padEnd(30)} | Password: ${ctv.password || defaultPassword} | Tên: ${ctv.displayName}`);
  }
}

seed5CTV()
  .catch((err) => {
    console.error('[X] Lỗi khi tạo CTV vào database:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
