import type { Prisma } from '@prisma/client';

export const CTV_LOCK_NAMESPACE = 17300000;

/**
 * Concurrency-safe CTV code generation.
 *
 * Acquires a PostgreSQL transaction-scoped advisory lock (17300000, year)
 * to serialize CTV code allocations across concurrent approvals.
 * The lock is automatically released when the surrounding transaction commits or rolls back.
 *
 * Uses numeric sequence extraction rather than lexical ordering to prevent
 * rollover collisions when crossing sequences such as 999 -> 1000.
 */
export async function generateCtvCode(
  tx: Prisma.TransactionClient,
  year = new Date().getFullYear(),
): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CTV_LOCK_NAMESPACE}::int, ${year}::int)`;

  const prefix = `CTV-${year}-`;
  const result = await tx.$queryRaw<{ max_seq: number | bigint | string | null }[]>`
    SELECT COALESCE(
      MAX(NULLIF(regexp_replace("ctvCode", '^CTV-' || ${year}::text || '-', ''), '')::integer),
      0
    ) AS max_seq
    FROM "Account"
    WHERE "ctvCode" ~ ('^CTV-' || ${year}::text || '-\\d+$')
  `;

  const maxSeq = Number(result[0]?.max_seq ?? 0);
  const seq = maxSeq + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}
