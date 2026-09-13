import type { ApiError } from './types';

export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: string }).name === 'AbortError'
  )
    return true;
  return false;
}

export function normalizeErrorMessage(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred',
): string {
  if (!error) return fallbackMessage;
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const apiErr = error as ApiError;
    if (apiErr.message) return apiErr.message;
  }
  if (
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallbackMessage;
}

export function getApiErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const obj = error as Record<string, unknown>;
  if (typeof obj.code === 'string') return obj.code;
  if (typeof obj.details === 'object' && obj.details !== null) {
    const details = obj.details as Record<string, unknown>;
    if (typeof details.error === 'object' && details.error !== null) {
      const err = details.error as Record<string, unknown>;
      if (typeof err.code === 'string') return err.code;
    }
  }
  return '';
}
