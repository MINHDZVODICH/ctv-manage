import type { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'node:crypto';
import { logger } from '../shared/logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

declare global {
  namespace Express {
    interface Request {
      id?: string;
      requestId?: string;
    }
  }
}

// Store the configured mount pattern, never req.baseUrl (which contains real IDs).
export function routeLogContext(mountPath: string): RequestHandler {
  return (_req, res, next) => {
    res.locals.logRouteBase = mountPath;
    next();
  };
}

function getRouteTemplate(req: Request, res: Response): string {
  if (typeof req.route?.path === 'string') {
    const routePath = req.route.path;
    const base = res.locals.logRouteBase ?? '';
    if (routePath === '/' || routePath === '') {
      return base || '/';
    }
    return `${base}${routePath}`;
  }
  return 'UNMATCHED';
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && UUID_REGEX.test(incomingId.trim())
      ? incomingId.trim()
      : crypto.randomUUID();

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startTime = Date.now();

  // Log request start
  logger.info(
    {
      requestId,
      method: req.method,
      actorId: req.user?.id,
    },
    `--> ${req.method}`,
  );

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const route = getRouteTemplate(req, res);

    logger.info(
      {
        requestId,
        method: req.method,
        route,
        status: res.statusCode,
        durationMs,
        actorId: req.user?.id,
      },
      `<-- ${req.method} ${route} ${res.statusCode} ${durationMs}ms`,
    );
  });

  next();
}
