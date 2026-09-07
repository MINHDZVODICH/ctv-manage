import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import argon2 from 'argon2';
import {
  validateDemoSeedEnvironment,
  assertResetAllowed,
  cleanDemoDatabase,
} from '../scripts/seed-demo';
import {
  validateAcceptanceSeedEnvironment,
} from '../scripts/seed-acceptance';
import {
  bootstrapAdmin,
} from '../scripts/bootstrap-admin';

describe('Seed Guards and Admin Bootstrap Unit Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('Demo Seed Guards (seed-demo.ts)', () => {
    it('1. rejects NODE_ENV !== "development"', () => {
      expect(() =>
        validateDemoSeedEnvironment({
          nodeEnv: 'production',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_dev?schema=public',
          demoPassword: 'secure-demo-password',
        }),
      ).toThrow(/NODE_ENV.*development/i);

      expect(() =>
        validateDemoSeedEnvironment({
          nodeEnv: 'test',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_dev?schema=public',
          demoPassword: 'secure-demo-password',
        }),
      ).toThrow(/NODE_ENV.*development/i);

      expect(() =>
        validateDemoSeedEnvironment({
          nodeEnv: undefined,
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_dev?schema=public',
          demoPassword: 'secure-demo-password',
        }),
      ).toThrow(/NODE_ENV.*development/i);
    });

    it('2. rejects database name lacking dev or demo marker', () => {
      // Must reject unmarked or production database names
      const invalidUrls = [
        'postgresql://user:pass@localhost:5432/ctv_manage?schema=public',
        'postgresql://user:pass@localhost:5432/ctv_production?schema=public',
        'postgresql://user:pass@localhost:5432/devices?schema=public',
        'postgresql://user:pass@localhost:5432/demographics?schema=public',
        'postgresql://user:pass@localhost:5432/production?schema=public',
      ];

      for (const url of invalidUrls) {
        expect(() =>
          validateDemoSeedEnvironment({
            nodeEnv: 'development',
            databaseUrl: url,
            demoPassword: 'secure-demo-password',
          }),
        ).toThrow(/(dev|demo)/i);
      }

      // Must accept properly delimited dev/demo database names
      const validUrls = [
        'postgresql://user:pass@localhost:5432/ctv_dev?schema=public',
        'postgresql://user:pass@localhost:5432/ctv_demo?schema=public',
        'postgresql://user:pass@localhost:5432/dev?schema=public',
        'postgresql://user:pass@localhost:5432/demo?schema=public',
        'postgresql://user:pass@localhost:5432/ctv-dev-local?schema=public',
        'postgresql://user:pass@localhost:5432/my_demo_db?schema=public',
      ];

      for (const url of validUrls) {
        expect(() =>
          validateDemoSeedEnvironment({
            nodeEnv: 'development',
            databaseUrl: url,
            demoPassword: 'secure-demo-password',
          }),
        ).not.toThrow();
      }
    });

    it('3. rejects truncate/delete if --reset flag is not passed', async () => {
      const mockPrisma = {
        history: { deleteMany: vi.fn() },
        shift: { deleteMany: vi.fn() },
        schedule: { deleteMany: vi.fn() },
        accountFile: { deleteMany: vi.fn() },
        registrationRequestFile: { deleteMany: vi.fn() },
        fileAsset: { deleteMany: vi.fn() },
        session: { deleteMany: vi.fn() },
        registrationRequest: { deleteMany: vi.fn() },
        account: { deleteMany: vi.fn() },
        snapshotRun: { deleteMany: vi.fn() },
        rateLimitWindow: { deleteMany: vi.fn() },
      };

      // Direct assertResetAllowed check
      expect(() => assertResetAllowed([])).toThrow(/--reset/i);
      expect(() => assertResetAllowed(['--other', '--force'])).toThrow(/--reset/i);
      expect(() => assertResetAllowed(['--reset'])).not.toThrow();

      // cleanDemoDatabase rejection without --reset
      await expect(cleanDemoDatabase(mockPrisma as any, [])).rejects.toThrow(/--reset/i);
      expect(mockPrisma.account.deleteMany).not.toHaveBeenCalled();

      // cleanDemoDatabase succeeds when --reset is passed
      await expect(cleanDemoDatabase(mockPrisma as any, ['--reset'])).resolves.not.toThrow();
      expect(mockPrisma.account.deleteMany).toHaveBeenCalled();
    });

    it('4. requires DEMO_PASSWORD environment variable', () => {
      expect(() =>
        validateDemoSeedEnvironment({
          nodeEnv: 'development',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_dev',
          demoPassword: '',
        }),
      ).toThrow(/DEMO_PASSWORD/i);

      expect(() =>
        validateDemoSeedEnvironment({
          nodeEnv: 'development',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_dev',
          demoPassword: '   ',
        }),
      ).toThrow(/DEMO_PASSWORD/i);

      expect(() =>
        validateDemoSeedEnvironment({
          nodeEnv: 'development',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_dev',
          demoPassword: undefined,
        }),
      ).toThrow(/DEMO_PASSWORD/i);

      expect(() =>
        validateDemoSeedEnvironment({
          nodeEnv: 'development',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_dev',
          demoPassword: 'valid-secret-password',
        }),
      ).not.toThrow();
    });
  });

  describe('Acceptance Seed Guards (seed-acceptance.ts)', () => {
    it('5. rejects NODE_ENV !== "test" and database without test marker', () => {
      // Rejects wrong NODE_ENV
      expect(() =>
        validateAcceptanceSeedEnvironment({
          nodeEnv: 'development',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_manage_test?schema=public',
        }),
      ).toThrow(/NODE_ENV.*test/i);

      expect(() =>
        validateAcceptanceSeedEnvironment({
          nodeEnv: 'production',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_manage_test?schema=public',
        }),
      ).toThrow(/NODE_ENV.*test/i);

      // Rejects database without test marker
      expect(() =>
        validateAcceptanceSeedEnvironment({
          nodeEnv: 'test',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_manage_dev?schema=public',
        }),
      ).toThrow(/test/i);

      expect(() =>
        validateAcceptanceSeedEnvironment({
          nodeEnv: 'test',
          databaseUrl: 'postgresql://user:pass@localhost:5432/testing_ground?schema=public',
        }),
      ).toThrow(/test/i);

      // Accepts test environment with valid test marker
      expect(() =>
        validateAcceptanceSeedEnvironment({
          nodeEnv: 'test',
          databaseUrl: 'postgresql://user:pass@localhost:5432/ctv_manage_test?schema=public',
        }),
      ).not.toThrow();

      expect(() =>
        validateAcceptanceSeedEnvironment({
          nodeEnv: 'test',
          databaseUrl: 'postgresql://user:pass@localhost:5432/test?schema=public',
        }),
      ).not.toThrow();
    });
  });

  describe('Admin Bootstrap (bootstrap-admin.ts)', () => {
    it('6. creates active admin with mustChangePassword = true when email does not exist', async () => {
      let createdData: any = null;
      const mockPrisma = {
        account: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async (args: any) => {
            createdData = args.data;
            return {
              id: 'acc_admin_001',
              ...args.data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }),
          update: vi.fn(),
          upsert: vi.fn(),
          delete: vi.fn(),
        },
      };

      const result = await bootstrapAdmin({
        email: '  Admin.Bootstrap@CTV.Local  ',
        password: 'AdminPassword123!',
        displayName: 'Bootstrap Administrator',
        prisma: mockPrisma as any,
      });

      expect(result.created).toBe(true);
      expect(result.email).toBe('admin.bootstrap@ctv.local');
      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin.bootstrap@ctv.local' },
      });
      expect(mockPrisma.account.create).toHaveBeenCalledTimes(1);

      expect(createdData).not.toBeNull();
      expect(createdData.email).toBe('admin.bootstrap@ctv.local');
      expect(createdData.role).toBe('ADMIN');
      expect(createdData.status).toBe('ACTIVE');
      expect(createdData.mustChangePassword).toBe(true);
      expect(createdData.displayName).toBe('Bootstrap Administrator');

      // Password must be Argon2 hashed, not plaintext
      expect(createdData.passwordHash).not.toBe('AdminPassword123!');
      const isPasswordValid = await argon2.verify(createdData.passwordHash, 'AdminPassword123!');
      expect(isPasswordValid).toBe(true);
    });

    it('7. refuses to overwrite or mutate if administrator email already exists', async () => {
      const existingAccount = {
        id: 'existing_admin_id',
        email: 'admin.bootstrap@ctv.local',
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$existinghash',
        mustChangePassword: false,
        displayName: 'Existing Administrator',
        version: 2,
      };

      const mockPrisma = {
        account: {
          findUnique: vi.fn().mockResolvedValue(existingAccount),
          create: vi.fn(),
          update: vi.fn(),
          upsert: vi.fn(),
          delete: vi.fn(),
          deleteMany: vi.fn(),
        },
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await bootstrapAdmin({
        email: 'admin.bootstrap@ctv.local',
        password: 'AttemptedNewPassword999!',
        displayName: 'Should Not Overwrite',
        prisma: mockPrisma as any,
      });

      expect(result.created).toBe(false);
      expect(result.email).toBe('admin.bootstrap@ctv.local');
      expect(result.message).toMatch(/already exists/i);

      // Must never call create, update, upsert, or delete
      expect(mockPrisma.account.create).not.toHaveBeenCalled();
      expect(mockPrisma.account.update).not.toHaveBeenCalled();
      expect(mockPrisma.account.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.account.delete).not.toHaveBeenCalled();
      expect(mockPrisma.account.deleteMany).not.toHaveBeenCalled();
    });
  });
});
