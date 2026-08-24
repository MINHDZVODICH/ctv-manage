import type { CookieOptions, Request, Response } from 'express';
import { config } from '../config.js';

export const SESSION_COOKIE_NAME = 'ctv_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function readSessionToken(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    if (name === SESSION_COOKIE_NAME) {
      const value = pair.slice(separator + 1).trim();
      return value || undefined;
    }
  }
  return undefined;
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

export function clearSessionCookie(response: Response): void {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  response.clearCookie(SESSION_COOKIE_NAME, options);
}

function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
  };
}
