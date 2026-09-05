import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const models = [
  ['Account', 'account'],
  ['Session', 'session'],
  ['RegistrationRequest', 'registrationRequest'],
  ['FileAsset', 'fileAsset'],
  ['RegistrationRequestFile', 'registrationRequestFile'],
  ['AccountFile', 'accountFile'],
  ['ScheduleRegistration', 'scheduleRegistration'],
  ['SchedulePatternSlot', 'schedulePatternSlot'],
  ['Shift', 'shift'],
  ['ShiftAssignment', 'shiftAssignment'],
  ['WorkHistory', 'workHistory'],
];

try {
  const rows = await Promise.all(
    models.map(async ([table, delegate]) => ({ table, rows: await prisma[delegate].count() })),
  );
  console.table(rows);
  console.log(`Total application rows: ${rows.reduce((total, row) => total + row.rows, 0)}`);
} finally {
  await prisma.$disconnect();
}
