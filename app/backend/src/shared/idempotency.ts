import { createHash } from 'node:crypto';
import {
  IdempotencyRecordStatus,
  Prisma,
  type IdempotencyRecord,
  type PrismaClient,
} from '@prisma/client';
import { ApiError } from './api-error.js';
import { prisma } from './prisma.js';

export interface StoredResponse {
  statusCode: number;
  body: unknown;
}

export interface IdempotencyContext {
  scope: string;
  fingerprint: string;
  key: string;
  requestHash: string;
}

export type IdempotencyReservation =
  | { kind: 'created'; record: IdempotencyRecord; workflowKey: string }
  | { kind: 'in-progress'; record: IdempotencyRecord }
  | { kind: 'replay'; record: IdempotencyRecord; response: StoredResponse };

export class IdempotencyService {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly now: () => Date = () => new Date(),
  ) {}

  requestHash(value: unknown): string {
    return createHash('sha256').update(stableJson(value)).digest('hex');
  }

  async reserve(context: IdempotencyContext): Promise<IdempotencyReservation> {
    const identity = this.identity(context);
    const existing = await this.database.idempotencyRecord.findUnique({
      where: { scope_fingerprintHash_keyHash: identity },
    });
    if (existing) return this.resolveExisting(existing, context);

    try {
      const record = await this.database.idempotencyRecord.create({
        data: {
          ...identity,
          requestHash: context.requestHash,
          status: IdempotencyRecordStatus.IN_PROGRESS,
          expiresAt: new Date(this.now().getTime() + 24 * 60 * 60 * 1000),
        },
      });
      return { kind: 'created', record, workflowKey: this.workflowKey(identity, record.id) };
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const concurrent = await this.database.idempotencyRecord.findUniqueOrThrow({
        where: { scope_fingerprintHash_keyHash: identity },
      });
      return this.resolveExisting(concurrent, context);
    }
  }

  async complete(
    database: Prisma.TransactionClient,
    recordId: string,
    resourceId: string,
    response: StoredResponse,
  ): Promise<void> {
    const completed = await database.idempotencyRecord.updateMany({
      where: { id: recordId, resourceId, status: IdempotencyRecordStatus.IN_PROGRESS },
      data: {
        status: IdempotencyRecordStatus.COMPLETED,
        responseStatus: response.statusCode,
        responseBody: JSON.stringify(response.body),
      },
    });
    if (completed.count !== 1) {
      throw new ApiError(500, 'IDEMPOTENCY_WORKFLOW_CORRUPTED', 'The idempotent workflow state changed unexpectedly.');
    }
  }

  private async resolveExisting(
    record: IdempotencyRecord,
    context: IdempotencyContext,
  ): Promise<IdempotencyReservation> {
    if (record.requestHash !== context.requestHash) {
      throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'The idempotency key was already used with a different payload.');
    }
    if (record.expiresAt.getTime() <= this.now().getTime()) {
      await this.database.idempotencyRecord.deleteMany({
        where: { id: record.id, expiresAt: { lte: this.now() } },
      });
      return this.reserve(context);
    }
    if (record.status === IdempotencyRecordStatus.IN_PROGRESS) {
      return { kind: 'in-progress', record };
    }
    if (record.responseStatus === null || record.responseBody === null) {
      throw new ApiError(409, 'IDEMPOTENCY_RESULT_UNAVAILABLE', 'The completed idempotent result is unavailable.');
    }
    return {
      kind: 'replay',
      record,
      response: { statusCode: record.responseStatus, body: JSON.parse(record.responseBody) as unknown },
    };
  }

  private identity(context: IdempotencyContext) {
    const scope = context.scope.trim();
    const fingerprint = context.fingerprint.trim();
    const key = context.key.trim();
    if (!scope || scope.length > 100 || !fingerprint || fingerprint.length > 500 || !key || key.length > 200) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'Idempotency scope, fingerprint, and key are required.');
    }
    return {
      scope,
      fingerprintHash: createHash('sha256').update(fingerprint).digest('hex'),
      keyHash: createHash('sha256').update(key).digest('hex'),
    };
  }

  private workflowKey(
    identity: { scope: string; fingerprintHash: string; keyHash: string },
    recordId: string,
  ): string {
    return createHash('sha256')
      .update(`${identity.scope}:${identity.fingerprintHash}:${identity.keyHash}:${recordId}`)
      .digest('hex');
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

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
