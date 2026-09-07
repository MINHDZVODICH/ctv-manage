import type { Request, Response, NextFunction } from 'express';
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

function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'apikey', 'api_key'];
    let modified = false;
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        parsed.searchParams.set(key, '[REDACTED]');
        modified = true;
      }
    }
    return modified ? `${parsed.pathname}${parsed.search}` : rawUrl;
  } catch {
    return rawUrl;
  }
}

function getRouteTemplate(req: Request): string {
  if (req.route?.path) {
    const routePath = typeof req.route.path === 'string' ? req.route.path : req.route.path.toString();
    const base = req.baseUrl || '';
    if (routePath === '/' || routePath === '') {
      return base || '/';
    }
    return `${base}${routePath}`;
  }
  return req.baseUrl || req.path || req.originalUrl;
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
  const safeUrl = sanitizeUrl(req.originalUrl || req.url);

  // Log request start
  logger.info(
    {
      requestId,
      method: req.method,
      url: safeUrl,
      actorId: req.user?.id,
    },
    `--> ${req.method} ${safeUrl}`,
  );

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const route = getRouteTemplate(req);

    logger.info(
      {
        requestId,
        method: req.method,
        url: safeUrl,
        route,
        status: res.statusCode,
        durationMs,
        actorId: req.user?.id,
      },
      `<-- ${req.method} ${safeUrl} ${res.statusCode} ${durationMs}ms`,
    );
  });

  next();
}
