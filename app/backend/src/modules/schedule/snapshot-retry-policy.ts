/**
 * Snapshot Retry Policy
 *
 * Encapsulates error code classification, backoff calculation,
 * and retry eligibility for schedule snapshot runs.
 */

export function standardizeSnapshotErrorCode(err: unknown): string {
  if (!err) return 'SNAPSHOT_EXECUTION_FAILED';
  if (typeof err === 'string') return /^[A-Z0-9_]+$/.test(err) ? err : 'SNAPSHOT_EXECUTION_FAILED';
  const { message, code } = err as { message?: string; code?: string };
  if (code && /^[A-Z0-9_]+$/.test(code)) return code;
  if (typeof message === 'string') {
    if (message.toLowerCase().includes('timeout')) return 'DB_TIMEOUT';
    if (/^[A-Z0-9_]+$/.test(message)) return message;
  }
  return 'SNAPSHOT_EXECUTION_FAILED';
}

/**
 * Options for configuring snapshot retry policy.
 */
export interface SnapshotRetryOptions {
  /**
   * Backoff intervals in minutes.
   * Default: [1, 5, 15, 30] where attempts beyond length reuse the final interval.
   */
  backoffScheduleMinutes?: number[];
}

export interface SnapshotRetryPolicy {
  standardizeErrorCode(err: unknown): string;
  calculateNextAttemptAt(attemptCount: number, now?: Date): Date;
}

export class DefaultSnapshotRetryPolicy implements SnapshotRetryPolicy {
  private readonly backoffScheduleMinutes: number[];

  constructor(options?: SnapshotRetryOptions) {
    this.backoffScheduleMinutes = options?.backoffScheduleMinutes ?? [1, 5, 15, 30];
  }

  standardizeErrorCode(err: unknown): string {
    return standardizeSnapshotErrorCode(err);
  }

  /**
   * Calculates next attempt time with backoff schedule.
   * Default backoff schedule:
   * attempt 1: 1 minute
   * attempt 2: 5 minutes
   * attempt 3: 15 minutes
   * attempt 4+: 30 minutes
   *
   * Unlimited recovery retry behavior: does not introduce arbitrary finite attempt caps
   * or permanent error classifications that silently skip dates.
   */
  calculateNextAttemptAt(attemptCount: number, now: Date = new Date()): Date {
    const intervals = this.backoffScheduleMinutes;
    const index = Math.max(0, Math.min(attemptCount - 1, intervals.length - 1));
    const minutes = intervals[index] ?? 30;
    return new Date(now.getTime() + minutes * 60_000);
  }
}
