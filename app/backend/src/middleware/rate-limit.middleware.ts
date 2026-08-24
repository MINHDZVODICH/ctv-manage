import type { Request, RequestHandler } from 'express';
import { ApiError } from '../shared/api-error.js';

interface RateLimitOptions {
  max: number;
  windowMs: number;
  key: (request: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetsAt: number;
}

export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const entries = new Map<string, RateLimitEntry>();

  return (request, response, next) => {
    const now = Date.now();
    const key = options.key(request);
    const previous = entries.get(key);
    const entry = !previous || previous.resetsAt <= now
      ? { count: 1, resetsAt: now + options.windowMs }
      : { count: previous.count + 1, resetsAt: previous.resetsAt };
    entries.set(key, entry);

    if (entry.count > options.max) {
      response.setHeader('Retry-After', Math.max(1, Math.ceil((entry.resetsAt - now) / 1000)));
      return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
    }
    next();
  };
}
