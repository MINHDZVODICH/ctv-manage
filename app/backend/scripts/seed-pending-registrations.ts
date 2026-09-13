import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

export interface PendingRegistrationItem {
  email: string;
  passwordHash: string;
  displayName: string;
  phone: string;
  dateOfBirth: Date;
  gender: 'Nam' | 'Nữ';
  address: string;
  status: 'PENDING';
  submittedAt: Date;
}

export const SAMPLE_PEOPLE: Array<{
  name: string;
  gender: 'Nam' | 'Nữ';
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  address: string;
}> = [
  {
    name: 'Nguyễn Văn An',
    gender: 'Nam',
    birthYear: 1998,
    birthMonth: 3,
    birthDay: 15,
    address: 'Cầu Giấy, Hà Nội',
  },
  {
    name: 'Trần Thị Bích',
    gender: 'Nữ',
    birthYear: 1999,
    birthMonth: 7,
    birthDay: 22,
    address: 'Đống Đa, Hà Nội',
  },
  {
    name: 'Lê Hoàng Cường',
    gender: 'Nam',
    birthYear: 1997,
    birthMonth: 11,
    birthDay: 5,
    address: 'Nam Từ Liêm, Hà Nội',
  },
  {
    name: 'Phạm Minh Đức',
    gender: 'Nam',
    birthYear: 2001,
    birthMonth: 5,
    birthDay: 12,
    address: 'Thanh Xuân, Hà Nội',
  },
  {
    name: 'Hoàng Thu Hà',
    gender: 'Nữ',
    birthYear: 2000,
    birthMonth: 9,
    birthDay: 18,
    address: 'Hai Bà Trưng, Hà Nội',
  },
  {
    name: 'Vũ Văn Hùng',
    gender: 'Nam',
    birthYear: 1996,
    birthMonth: 2,
    birthDay: 28,
    address: 'Hà Đông, Hà Nội',
  },
  {
    name: 'Đặng Hải Yến',
    gender: 'Nữ',
    birthYear: 2002,
    birthMonth: 8,
    birthDay: 14,
    address: 'Bắc Từ Liêm, Hà Nội',
  },
  {
    name: 'Bùi Quang Huy',
    gender: 'Nam',
    birthYear: 1999,
    birthMonth: 4,
    birthDay: 9,
    address: 'Ba Đình, Hà Nội',
  },
  {
    name: 'Đỗ Thị Mai',
    gender: 'Nữ',
    birthYear: 2001,
    birthMonth: 12,
    birthDay: 3,
    address: 'Hoàng Mai, Hà Nội',
  },
  {
    name: 'Ngô Quốc Bảo',
    gender: 'Nam',
    birthYear: 1998,
    birthMonth: 6,
    birthDay: 25,
    address: 'Long Biên, Hà Nội',
  },
  {
    name: 'Dương Ngọc Ánh',
    gender: 'Nữ',
    birthYear: 2003,
    birthMonth: 1,
    birthDay: 19,
    address: 'Tây Hồ, Hà Nội',
  },
  {
    name: 'Lý Gia Huy',
    gender: 'Nam',
    birthYear: 2000,
    birthMonth: 10,
    birthDay: 30,
    address: 'Quận 1, TP. Hồ Chí Minh',
  },
  {
    name: 'Mai Phương Thảo',
    gender: 'Nữ',
    birthYear: 1999,
    birthMonth: 5,
    birthDay: 8,
    address: 'Quận 3, TP. Hồ Chí Minh',
  },
  {
    name: 'Phan Thanh Tùng',
    gender: 'Nam',
    birthYear: 1997,
    birthMonth: 8,
    birthDay: 17,
    address: 'Bình Thạnh, TP. Hồ Chí Minh',
  },
  {
    name: 'Đoàn Văn Hậu',
    gender: 'Nam',
    birthYear: 1999,
    birthMonth: 4,
    birthDay: 19,
    address: 'Quận 7, TP. Hồ Chí Minh',
  },
  {
    name: 'Đinh Thị Lan',
    gender: 'Nữ',
    birthYear: 2002,
    birthMonth: 11,
    birthDay: 23,
    address: 'Hải Châu, Đà Nẵng',
  },
  {
    name: 'Trịnh Công Minh',
    gender: 'Nam',
    birthYear: 1998,
    birthMonth: 12,
    birthDay: 10,
    address: 'Thanh Khê, Đà Nẵng',
  },
  {
    name: 'Lâm Chí Dũng',
    gender: 'Nam',
    birthYear: 1996,
    birthMonth: 7,
    birthDay: 7,
    address: 'Sơn Trà, Đà Nẵng',
  },
  {
    name: 'Tạ Thị Thúy',
    gender: 'Nữ',
    birthYear: 2001,
    birthMonth: 3,
    birthDay: 29,
    address: 'Hồng Bàng, Hải Phòng',
  },
  {
    name: 'Trương Bá Thắng',
    gender: 'Nam',
    birthYear: 1997,
    birthMonth: 10,
    birthDay: 15,
    address: 'Ngô Quyền, Hải Phòng',
  },
  {
    name: 'Lương Thị Kim Oanh',
    gender: 'Nữ',
    birthYear: 2000,
    birthMonth: 2,
    birthDay: 14,
    address: 'Ninh Kiều, Cần Thơ',
  },
  {
    name: 'Phùng Văn Kiên',
    gender: 'Nam',
    birthYear: 1998,
    birthMonth: 9,
    birthDay: 21,
    address: 'Cầu Giấy, Hà Nội',
  },
  {
    name: 'Cao Thị Thuỳ Trang',
    gender: 'Nữ',
    birthYear: 2001,
    birthMonth: 6,
    birthDay: 11,
    address: 'Thanh Xuân, Hà Nội',
  },
  {
    name: 'Hồ Hữu Nghĩa',
    gender: 'Nam',
    birthYear: 1995,
    birthMonth: 1,
    birthDay: 27,
    address: 'Đống Đa, Hà Nội',
  },
  {
    name: 'Hà Diệu Linh',
    gender: 'Nữ',
    birthYear: 2002,
    birthMonth: 4,
    birthDay: 16,
    address: 'Hai Bà Trưng, Hà Nội',
  },
  {
    name: 'Tô Hoài Nam',
    gender: 'Nam',
    birthYear: 1997,
    birthMonth: 8,
    birthDay: 3,
    address: 'Nam Từ Liêm, Hà Nội',
  },
  {
    name: 'Chu Minh Trí',
    gender: 'Nam',
    birthYear: 1999,
    birthMonth: 11,
    birthDay: 12,
    address: 'Hà Đông, Hà Nội',
  },
  {
    name: 'Nông Thị Phương',
    gender: 'Nữ',
    birthYear: 2003,
    birthMonth: 5,
    birthDay: 20,
    address: 'Bắc Từ Liêm, Hà Nội',
  },
  {
    name: 'Quách Tuấn Anh',
    gender: 'Nam',
    birthYear: 1998,
    birthMonth: 10,
    birthDay: 8,
    address: 'Hoàng Mai, Hà Nội',
  },
  {
    name: 'Diệp Bảo Ngọc',
    gender: 'Nữ',
    birthYear: 2000,
    birthMonth: 7,
    birthDay: 25,
    address: 'Ba Đình, Hà Nội',
  },
  {
    name: 'La Văn Sỹ',
    gender: 'Nam',
    birthYear: 1996,
    birthMonth: 3,
    birthDay: 18,
    address: 'Tây Hồ, Hà Nội',
  },
  {
    name: 'Tăng Thanh Hà',
    gender: 'Nữ',
    birthYear: 1999,
    birthMonth: 12,
    birthDay: 24,
    address: 'Long Biên, Hà Nội',
  },
  {
    name: 'Lưu Đức Hoà',
    gender: 'Nam',
    birthYear: 1997,
    birthMonth: 2,
    birthDay: 13,
    address: 'Gia Lâm, Hà Nội',
  },
  {
    name: 'Khổng Minh Tú',
    gender: 'Nữ',
    birthYear: 2001,
    birthMonth: 8,
    birthDay: 31,
    address: 'Thanh Trì, Hà Nội',
  },
  {
    name: 'Tiêu Thị Hằng',
    gender: 'Nữ',
    birthYear: 2002,
    birthMonth: 9,
    birthDay: 6,
    address: 'Hoài Đức, Hà Nội',
  },
  {
    name: 'Ôn Gia Bảo',
    gender: 'Nam',
    birthYear: 1998,
    birthMonth: 1,
    birthDay: 15,
    address: 'Đông Anh, Hà Nội',
  },
  {
    name: 'Bạch Quốc Việt',
    gender: 'Nam',
    birthYear: 1995,
    birthMonth: 6,
    birthDay: 28,
    address: 'Sóc Sơn, Hà Nội',
  },
  {
    name: 'Giáp Thị Thu',
    gender: 'Nữ',
    birthYear: 2000,
    birthMonth: 11,
    birthDay: 17,
    address: 'Thủ Đức, TP. Hồ Chí Minh',
  },
  {
    name: 'Kiều Anh Tuấn',
    gender: 'Nam',
    birthYear: 1997,
    birthMonth: 4,
    birthDay: 5,
    address: 'Tân Bình, TP. Hồ Chí Minh',
  },
  {
    name: 'Triệu Lệ Quyên',
    gender: 'Nữ',
    birthYear: 2001,
    birthMonth: 10,
    birthDay: 22,
    address: 'Phú Nhuận, TP. Hồ Chí Minh',
  },
  {
    name: 'Doãn Quốc Đam',
    gender: 'Nam',
    birthYear: 1996,
    birthMonth: 5,
    birthDay: 14,
    address: 'Gò Vấp, TP. Hồ Chí Minh',
  },
  {
    name: 'Thân Đức Nam',
    gender: 'Nam',
    birthYear: 1999,
    birthMonth: 7,
    birthDay: 19,
    address: 'Quận 10, TP. Hồ Chí Minh',
  },
  {
    name: 'Cầm Thị Loan',
    gender: 'Nữ',
    birthYear: 2002,
    birthMonth: 3,
    birthDay: 2,
    address: 'Quận 5, TP. Hồ Chí Minh',
  },
  {
    name: 'Lường Văn Toàn',
    gender: 'Nam',
    birthYear: 1998,
    birthMonth: 8,
    birthDay: 26,
    address: 'Quận 12, TP. Hồ Chí Minh',
  },
  {
    name: 'Mã Bá Hưng',
    gender: 'Nam',
    birthYear: 1997,
    birthMonth: 12,
    birthDay: 1,
    address: 'Liên Chiểu, Đà Nẵng',
  },
  {
    name: 'Sử Thị Phượng',
    gender: 'Nữ',
    birthYear: 2000,
    birthMonth: 4,
    birthDay: 10,
    address: 'Ngũ Hành Sơn, Đà Nẵng',
  },
  {
    name: 'Vưu Khải Huyền',
    gender: 'Nam',
    birthYear: 1995,
    birthMonth: 9,
    birthDay: 15,
    address: 'Cẩm Lệ, Đà Nẵng',
  },
  {
    name: 'Vi Thị Thảo',
    gender: 'Nữ',
    birthYear: 2003,
    birthMonth: 2,
    birthDay: 21,
    address: 'Lê Chân, Hải Phòng',
  },
  {
    name: 'Diệp Lâm Anh',
    gender: 'Nữ',
    birthYear: 1998,
    birthMonth: 6,
    birthDay: 9,
    address: 'Kiến An, Hải Phòng',
  },
  {
    name: 'Nguyễn Khắc Tiệp',
    gender: 'Nam',
    birthYear: 1996,
    birthMonth: 11,
    birthDay: 28,
    address: 'Bình Thủy, Cần Thơ',
  },
];

export async function generatePendingRegistrationData(
  count: number = 50,
  password: string = '12345678',
): Promise<PendingRegistrationItem[]> {
  const passwordHash = await argon2.hash(password);
  const now = Date.now();
  const items: PendingRegistrationItem[] = [];

  for (let i = 0; i < count; i++) {
    const person = SAMPLE_PEOPLE[i % SAMPLE_PEOPLE.length];
    const indexStr = String(i + 1).padStart(2, '0');
    const email = `pending.ctv${indexStr}@gmail.com`;
    const phone = `098${String(10000000 + i + 1).slice(1)}`;
    const dateOfBirth = new Date(
      Date.UTC(person.birthYear, person.birthMonth - 1, person.birthDay),
    );

    // Stagger submission time backwards over the last 30 days
    const daysAgo = Math.floor((i * 28) / count);
    const hoursAgo = (i * 3) % 24;
    const submittedAt = new Date(now - (daysAgo * 24 + hoursAgo) * 3600 * 1000);

    items.push({
      email,
      passwordHash,
      displayName: person.name,
      phone,
      dateOfBirth,
      gender: person.gender,
      address: person.address,
      status: 'PENDING',
      submittedAt,
    });
  }

  return items;
}

export interface SeedPendingResult {
  totalAttempted: number;
  createdCount: number;
  skippedCount: number;
  createdEmails: string[];
}

export async function seedPendingRegistrations(
  options: { prisma?: any; count?: number; password?: string } = {},
): Promise<SeedPendingResult> {
  const isInternalClient = !options.prisma;
  const prisma = options.prisma ?? new PrismaClient();
  const count = options.count ?? 50;
  const password = options.password ?? '12345678';

  try {
    const items = await generatePendingRegistrationData(count, password);
    const emails = items.map((it) => it.email);

    // Conflict check with existing accounts and registration requests
    const [existingAccounts, existingRequests] = await Promise.all([
      prisma.account.findMany({
        where: { email: { in: emails }, deletedAt: null },
        select: { email: true },
      }),
      prisma.registrationRequest.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
    ]);

    const existingEmailSet = new Set([
      ...existingAccounts.map((a: { email: string }) => a.email.toLowerCase()),
      ...existingRequests.map((r: { email: string }) => r.email.toLowerCase()),
    ]);

    const toCreate = items.filter((it) => !existingEmailSet.has(it.email.toLowerCase()));

    if (toCreate.length > 0) {
      await prisma.registrationRequest.createMany({
        data: toCreate,
      });
    }

    const createdEmails = toCreate.map((it) => it.email);
    return {
      totalAttempted: items.length,
      createdCount: toCreate.length,
      skippedCount: items.length - toCreate.length,
      createdEmails,
    };
  } finally {
    if (isInternalClient) {
      await prisma.$disconnect();
    }
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Boolean(
    process.argv[1] &&
    process.argv[1].replace(/\\/g, '/').endsWith('scripts/seed-pending-registrations.ts'),
  );

if (isDirectRun) {
  seedPendingRegistrations()
    .then((res) => {
      console.log(`✅ Seed hoàn tất!`);
      console.log(`   - Tổng yêu cầu: ${res.totalAttempted}`);
      console.log(`   - Tạo mới: ${res.createdCount}`);
      console.log(`   - Đã bỏ qua (đã tồn tại): ${res.skippedCount}`);
      console.log(`   - Mật khẩu mặc định: 12345678`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`❌ Seed thất bại:`, err);
      process.exit(1);
    });
}
