import { describe, it, expect } from 'vitest';
import argon2 from 'argon2';
import { generatePendingRegistrationData } from '../scripts/seed-pending-registrations.js';

describe('generatePendingRegistrationData', () => {
  it('generates 50 unique pending registration records with default password 12345678', async () => {
    const password = '12345678';
    const records = await generatePendingRegistrationData(50, password);

    expect(records).toHaveLength(50);

    const emails = new Set(records.map((r) => r.email));
    expect(emails.size).toBe(50);

    const phones = new Set(records.map((r) => r.phone));
    expect(phones.size).toBe(50);

    for (const record of records) {
      expect(record.status).toBe('PENDING');
      expect(record.displayName).toBeTruthy();
      expect(typeof record.displayName).toBe('string');
      expect(record.phone).toMatch(/^0[3|5|7|8|9][0-9]{8}$/);
      expect(record.gender).toMatch(/^(Nam|Nữ)$/);
      expect(record.address).toBeTruthy();
      expect(record.dateOfBirth).toBeInstanceOf(Date);
      expect(record.submittedAt).toBeInstanceOf(Date);
      expect(record.passwordHash).toBeTruthy();
    }

    // Verify first record's argon2 password hash against '12345678'
    const isPasswordValid = await argon2.verify(records[0].passwordHash, password);
    expect(isPasswordValid).toBe(true);
  });

  it('skips existing emails and inserts only new records', async () => {
    let createdRecords: any[] = [];
    const mockPrisma = {
      account: {
        findMany: async () => [{ email: 'pending.ctv01@gmail.com' }],
      },
      registrationRequest: {
        findMany: async () => [{ email: 'pending.ctv02@gmail.com' }],
        createMany: async ({ data }: { data: any[] }) => {
          createdRecords = data;
          return { count: data.length };
        },
      },
    };

    const { seedPendingRegistrations } = await import('../scripts/seed-pending-registrations.js');
    const result = await seedPendingRegistrations({ prisma: mockPrisma, count: 5 });

    expect(result.totalAttempted).toBe(5);
    expect(result.skippedCount).toBe(2);
    expect(result.createdCount).toBe(3);
    expect(createdRecords).toHaveLength(3);
    expect(result.createdEmails).not.toContain('pending.ctv01@gmail.com');
    expect(result.createdEmails).not.toContain('pending.ctv02@gmail.com');
  });
});

