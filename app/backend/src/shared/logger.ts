import pino from 'pino';
import { Writable } from 'node:stream';

function formatLogLine(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const entry = JSON.parse(trimmed);
    const msg = entry.msg ?? '';
    const err =
      entry.err?.stack ||
      entry.err?.message ||
      entry.error?.stack ||
      entry.error?.message;
    if (msg && err) {
      return `${msg}: ${err}\n`;
    }
    if (msg) {
      return `${msg}\n`;
    }
    return `${trimmed}\n`;
  } catch {
    return `${trimmed}\n`;
  }
}

const msgOnlyStream = new Writable({
  write(chunk: Buffer | string, _encoding, callback) {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    const lines = text.split('\n');
    for (const line of lines) {
      const formatted = formatLogLine(line);
      if (formatted) {
        process.stdout.write(formatted);
      }
    }
    callback();
  },
});

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? 'info' },
  process.env.LOG_FORMAT === 'json' ? process.stdout : msgOnlyStream,
);
