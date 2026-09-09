import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  incrementRateLimit,
  cleanupExpiredRateLimits,
  type RateLimitScope,
} from '../shared/rateLimitStore.js';
import { logger } from '../shared/logger.js';

export interface RateLimitOptions {
  scope: RateLimitScope;
  maxRequests: number;
  windowSeconds: number;
  keyGenerator: (req: Request) => string;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = options.keyGenerator(req);
      const { requestCount, expiresAt } = await incrementRateLimit(
        options.scope,
        identity,
        options.windowSeconds,
      );

      if (requestCount > options.maxRequests) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
        );
        logger.warn(
          {
            event: 'ratelimit.rejected',
            scope: options.scope,
            retryAfter: retryAfterSeconds,
          },
          'Rate limit rejected',
        );
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau.',
          },
        });
        return;
      }

      next();
    } catch (err) {
      logger.error({ err, scope: options.scope }, 'Rate limit check failed - failing closed');
      res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
        },
      });
    }
  };
}

export { cleanupExpiredRateLimits };
