import { createHash } from 'node:crypto';
import type { IdempotencyRecord, Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from './api-error.js';
import { prisma } from './prisma.js';

export interface ReplayedResponse {
  statusCode: number;
  body: unknown;
}

type IdempotencyDatabase = PrismaClient | Prisma.TransactionClient;

export class IdempotencyService {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly now: () => Date = () => new Date(),
  ) {}

  requestHash(value: unknown): string {
    return createHash('sha256').update(stableJson(value)).digest('hex');
  }

  keyHash(key: string): string {
    const normalized = key.trim();
    if (!normalized || normalized.length > 200) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'Idempotency-Key is required and must not exceed 200 characters.');
    }
    return createHash('sha256').update(normalized).digest('hex');
  }

  async replay(key: string, requestHash: string, database: IdempotencyDatabase = this.database): Promise<ReplayedResponse | undefined> {
    const record = await database.idempotencyRecord.findUnique({ where: { key: this.keyHash(key) } });
    if (!record) return undefined;
    this.ensureMatching(record, requestHash);
    if (record.expiresAt.getTime() <= this.now().getTime()) {
      await database.idempotencyRecord.deleteMany({
        where: { id: record.id, expiresAt: { lte: this.now() } },
      });
      return undefined;
    }
    if (record.responseStatus === null || record.responseBody === null) {
      throw new ApiError(409, 'IDEMPOTENCY_REQUEST_IN_PROGRESS', 'A matching request is still being processed.');
    }
    return { statusCode: record.responseStatus, body: JSON.parse(record.responseBody) as unknown };
  }

  recordData(key: string, requestHash: string, response: ReplayedResponse): Prisma.IdempotencyRecordCreateInput {
    return {
      key: this.keyHash(key),
      requestHash,
      responseStatus: response.statusCode,
      responseBody: JSON.stringify(response.body),
      expiresAt: new Date(this.now().getTime() + 24 * 60 * 60 * 1000),
    };
  }

  private ensureMatching(record: IdempotencyRecord, requestHash: string): void {
    if (record.requestHash !== requestHash) {
      throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'The idempotency key was already used with a different payload.');
    }
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
