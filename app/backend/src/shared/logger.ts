import pino, { type DestinationStream, type Logger } from 'pino';
import { config } from '../config.js';

export function createLogger(destination?: DestinationStream, level = config.NODE_ENV === 'production' ? 'info' : 'silent'): Logger {
  return pino({
    level,
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers.x-csrf-token',
      'password',
      'passwordHash',
      'token',
    ],
  }, destination);
}

export const logger = createLogger();
