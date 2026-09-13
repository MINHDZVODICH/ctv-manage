import type { Request, Response } from 'express';
import { prisma } from '../../shared/prisma.js';
import { logger } from '../../shared/logger.js';

let shuttingDown = false;

export function setShuttingDown(val: boolean = true): void {
  shuttingDown = val;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok' });
}

export function getLive(_req: Request, res: Response): void {
  res.status(200).json({ status: 'live' });
}

export async function getReady(_req: Request, res: Response): Promise<void> {
  if (shuttingDown) {
    res.status(503).json({ status: 'not_ready' });
    return;
  }

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Database health check timed out'));
    }, 2000);
    timer.unref?.();
  });

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeoutPromise,
    ]);
    if (timer) clearTimeout(timer);
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    if (timer) clearTimeout(timer);
    logger.error({ err: error, error }, 'Readiness check failed');
    res.status(503).json({ status: 'not_ready' });
  }
}
