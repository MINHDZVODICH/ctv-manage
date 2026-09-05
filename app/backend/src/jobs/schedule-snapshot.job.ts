import { snapshotTodayWorkHistory } from '../modules/schedule/schedule.service.js';
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
 * Starts the daily schedule snapshot job at 17:30 Asia/Bangkok,
 * and performs an initial snapshot check on startup.
 */
export function startScheduleSnapshotJob(): ScheduleSnapshotJobController {
  let timer: NodeJS.Timeout | null = null;
  let isStopped = false;

  const runSnapshot = async () => {
    try {
      await snapshotTodayWorkHistory();
      logger.info('Daily schedule snapshot completed successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to snapshot today work history');
    }
  };

  const scheduleNext = () => {
    if (isStopped) return;
    const delayMs = getDelayUntilNextBangkok1730();
    timer = setTimeout(() => {
      void runSnapshot().then(() => {
        scheduleNext();
      });
    }, delayMs);
    timer.unref();
  };

  // Run initial snapshot on startup
  void runSnapshot();

  // Schedule next recurring snapshot
  scheduleNext();

  return {
    stop: () => {
      isStopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      logger.info('Schedule snapshot background job stopped');
    },
    triggerNow: runSnapshot,
  };
}
