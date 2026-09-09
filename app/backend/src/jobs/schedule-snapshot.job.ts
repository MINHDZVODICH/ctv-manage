import { SnapshotCoordinatorService } from '../modules/schedule/snapshot-coordinator.service.js';
import { logger } from '../shared/logger.js';

export interface ScheduleSnapshotJobController {
  stop: () => Promise<void>;
  triggerNow: () => Promise<void>;
  waitForActiveTask: () => Promise<void>;
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
  let activeReconcilePromise: Promise<void> | null = null;

  const runReconcile = async () => {
    if (isStopped) return;
    // Timer ticks and manual triggers join the same in-flight reconciliation.
    if (activeReconcilePromise) return activeReconcilePromise;
    const task = (async () => {
      try {
        await coordinator.reconcilePass();
        logger.debug('Schedule snapshot reconciliation pass completed');
      } catch (error) {
        logger.error({ error }, 'Failed to reconcile work history');
      }
    })();
    activeReconcilePromise = task;
    try {
      await task;
    } finally {
      if (activeReconcilePromise === task) {
        activeReconcilePromise = null;
      }
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
    stop: async () => {
      isStopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      logger.info('Schedule snapshot background job stopped');
      if (activeReconcilePromise) {
        await activeReconcilePromise;
      }
    },
    triggerNow: runReconcile,
    waitForActiveTask: async () => {
      if (activeReconcilePromise) {
        await activeReconcilePromise;
      }
    },
  };
}
