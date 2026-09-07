import { SnapshotCoordinatorService } from '../modules/schedule/snapshot-coordinator.service.js';
import { logger } from '../shared/logger.js';

export interface ScheduleSnapshotJobController {
  stop: () => void;
  triggerNow: () => Promise<void>;
}

/**
 * Calculates the delay in milliseconds until the next 17:30 Asia/Bangkok (10:30 UTC).
 */
export function getDelayUntilNextBangkok1730(now: Date = new Date()): number {
  const targetUtc = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      10,
      30,
      0,
      0,
    ),
  );

  if (now.getTime() >= targetUtc.getTime()) {
    targetUtc.setUTCDate(targetUtc.getUTCDate() + 1);
  }

  return targetUtc.getTime() - now.getTime();
}

/**
 * Starts the persistent schedule snapshot coordinator with a 60-second reconciliation interval,
 * and performs an initial reconciliation check on startup.
 */
export function startScheduleSnapshotJob(): ScheduleSnapshotJobController {
  const coordinator = new SnapshotCoordinatorService();
  let timer: NodeJS.Timeout | null = null;
  let isStopped = false;

  const runReconcile = async () => {
    try {
      await coordinator.reconcilePass();
      logger.info('Daily schedule snapshot completed successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to snapshot today work history');
    }
  };

  // Run initial pass on startup
  void runReconcile();

  // Run periodic reconciliation pass every 60 seconds
  timer = setInterval(() => {
    if (!isStopped) {
      void runReconcile();
    }
  }, 60_000);
  timer.unref();

  return {
    stop: () => {
      isStopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      logger.info('Schedule snapshot background job stopped');
    },
    triggerNow: runReconcile,
  };
}
