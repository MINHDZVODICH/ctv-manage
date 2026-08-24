import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestIdMiddleware: RequestHandler = (_request, response, next) => {
  response.locals.requestId = `req_${randomUUID()}`;
  response.setHeader('X-Request-Id', response.locals.requestId);
  next();
};
