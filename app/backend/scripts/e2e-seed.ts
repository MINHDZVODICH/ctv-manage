import argon2 from 'argon2';
import { execFileSync } from 'node:child_process';
import { PrismaClient, AccountRole, AccountStatus, RoomCode, ScheduleRegistrationStatus, ShiftAssignmentStatus, ShiftPeriod, ShiftStatus } from '@prisma/client';

if (process.env.E2E_TEST !== '1' || process.env.NODE_ENV === 'production') {
  throw new Error('The deterministic seed is available only with E2E_TEST=1 outside production.');
}

const prisma = new PrismaClient();
const password = 'E2ePass123';

async function main() {
  await resetSchema();
  await prisma.notification.deleteMany(); await prisma.shiftAssignment.deleteMany(); await prisma.schedulePatternSlot.deleteMany(); await prisma.scheduleRegistration.deleteMany(); await prisma.shift.deleteMany(); await prisma.registrationRequest.deleteMany(); await prisma.account.deleteMany();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const [admin, ctv] = await Promise.all([
    prisma.account.create({ data: { email: 'admin.e2e@ctv.local', passwordHash, role: AccountRole.ADMIN, status: AccountStatus.ACTIVE, mustChangePassword: false, displayName: 'Quản trị viên' } }),
    prisma.account.create({ data: { email: 'ctv.e2e@ctv.local', passwordHash, role: AccountRole.CTV, status: AccountStatus.ACTIVE, mustChangePassword: false, displayName: 'Nguyễn Văn A', phone: '0900000000', ctvCode: 'CTV-E2E', joinedAt: new Date('2026-08-01T00:00:00.000Z') } }),
  ]);
  await prisma.registrationRequest.create({ data: { email: 'approved.e2e@ctv.local', passwordHash, displayName: 'Hồ sơ E2E', phone: '0912345678', submittedAt: new Date('2026-08-25T08:00:00.000Z') } });
  const registration = await prisma.scheduleRegistration.create({ data: { accountId: ctv.id, startDate: new Date('2026-08-25T00:00:00.000Z'), endDate: new Date('2026-10-24T00:00:00.000Z'), timeZone: 'Asia/Bangkok', roomCode: RoomCode.ROOM_1, workContent: 'Hỗ trợ xử lý dữ liệu', status: ScheduleRegistrationStatus.ACTIVE, patternSlots: { create: { weekday: 1, period: ShiftPeriod.MORNING } } } });
  const shift = await prisma.shift.create({ data: { workDate: new Date('2026-08-25T00:00:00.000Z'), period: ShiftPeriod.MORNING, status: ShiftStatus.OPEN } });
  await prisma.shiftAssignment.create({ data: { shiftId: shift.id, accountId: ctv.id, registrationId: registration.id, roomCode: RoomCode.ROOM_1, workContent: 'Hỗ trợ xử lý dữ liệu', status: ShiftAssignmentStatus.ACTIVE } });
  await prisma.notification.create({ data: { accountId: admin.id, type: 'E2E', title: 'Thông báo quản trị', message: 'Dữ liệu kiểm thử ổn định.' } });
  await prisma.notification.create({ data: { accountId: ctv.id, type: 'E2E', title: 'Thông báo CTV', message: 'Lịch làm việc đã sẵn sàng.' } });
}

async function resetSchema() {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys=OFF');
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
  for (const { name } of tables) await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \"${name.replaceAll('\"', '\"\"')}\"`);
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx.cmd prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script']
    : ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'];
  const script = execFileSync(command, args, { encoding: 'utf8', env: process.env });
  for (const statement of script.split(/;\s*(?:\r?\n|$)/)) if (statement.trim()) await prisma.$executeRawUnsafe(statement);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleRegistration_one_active_per_account" ON "ScheduleRegistration"("accountId") WHERE "status" = \'ACTIVE\'');
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys=ON');
}

main().finally(() => prisma.$disconnect());
