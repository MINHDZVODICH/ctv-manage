import { SnapshotCoordinatorService } from '../modules/schedule/snapshot-coordinator.service.js';
import { getDelayUntilNextBangkok1730 } from '../shared/timezone.js';
import { logger } from '../shared/logger.js';

export { getDelayUntilNextBangkok1730 };

export interface ScheduleSnapshotJobController {
  stop: () => Promise<void>;
  triggerNow: () => Promise<void>;
  waitForActiveTask: () => Promise<void>;
}

/**
 * Starts the schedule snapshot coordinator using event-driven scheduling (Option B):
 * - Performs an initial reconciliation pass on startup.
 * - Dynamically schedules the next timer for either the earliest pending retry or 17:30 Asia/Bangkok cutoff.
 * - Reschedules immediately upon completion or failure.
 * - Avoids continuous 60-second polling overhead while preserving recovery guarantees.
 */
export function startScheduleSnapshotJob(): ScheduleSnapshotJobController {
  const coordinator = new SnapshotCoordinatorService();
  let timer: NodeJS.Timeout | null = null;
  let isStopped = false;
  let activeReconcilePromise: Promise<void> | null = null;

  const scheduleNext = async () => {
    if (isStopped) return;
    try {
      const delayMs = coordinator.getNextWakeDelay
        ? await coordinator.getNextWakeDelay()
        : getDelayUntilNextBangkok1730();
      if (isStopped) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      timer = setTimeout(() => {
        void runReconcile();
      }, delayMs);
      timer.unref();
      logger.debug({ delayMs }, 'Scheduled next snapshot wake');
    } catch (error) {
      if (isStopped) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      // Fallback timer on transient error
      logger.error(
        { error },
        'Failed to determine next snapshot wake delay, falling back to 60s retry',
      );
      timer = setTimeout(() => {
        void runReconcile();
      }, 60_000);
      timer.unref();
    }
  };

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
      } finally {
        await scheduleNext();
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

  return {
    stop: async () => {
      isStopped = true;
      if (timer) {
        clearTimeout(timer);
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
