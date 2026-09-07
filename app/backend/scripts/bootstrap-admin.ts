import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

export interface BootstrapAdminOptions {
  email?: string;
  password?: string;
  displayName?: string;
  ctvCode?: string | null;
  prisma?: any;
}

export interface BootstrapAdminResult {
  created: boolean;
  accountId?: string;
  email: string;
  message: string;
}

export async function bootstrapAdmin(
  options: BootstrapAdminOptions = {},
): Promise<BootstrapAdminResult> {
  const rawEmail = options.email ?? process.env.ADMIN_EMAIL;
  if (!rawEmail || !rawEmail.trim()) {
    throw new Error('ADMIN_EMAIL environment variable is required.');
  }

  const rawPassword = options.password ?? process.env.ADMIN_PASSWORD;
  if (!rawPassword || !rawPassword.trim()) {
    throw new Error('ADMIN_PASSWORD environment variable is required.');
  }

  const normalizedEmail = rawEmail.trim().toLowerCase();
  const displayName = options.displayName ?? process.env.ADMIN_DISPLAY_NAME ?? 'Administrator';
  const ctvCode = options.ctvCode ?? process.env.ADMIN_CTV_CODE ?? null;

  const isInternalClient = !options.prisma;
  const prisma = options.prisma ?? new PrismaClient();

  try {
    const existing = await prisma.account.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      const message = `Administrator account already exists for ${normalizedEmail}. Skipping bootstrap without mutation.`;
      console.log(message);
      return {
        created: false,
        accountId: existing.id,
        email: normalizedEmail,
        message,
      };
    }

    const passwordHash = await argon2.hash(rawPassword);
    const createdAccount = await prisma.account.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        mustChangePassword: true,
        displayName,
        ctvCode,
      },
    });

    console.log(`✅ Administrator account created successfully for ${normalizedEmail} (mustChangePassword: true).`);
    return {
      created: true,
      accountId: createdAccount.id,
      email: normalizedEmail,
      message: 'Administrator created successfully',
    };
  } finally {
    if (isInternalClient) {
      await prisma.$disconnect();
    }
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Boolean(process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/bootstrap-admin.ts'));

if (isDirectRun) {
  bootstrapAdmin()
    .then((result) => {
      if (!result.created) {
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('❌ Administrator bootstrap failed:', error);
      process.exit(1);
    });
}
