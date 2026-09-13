import { describe, it, expect } from 'vitest';
import { isAbortError, normalizeErrorMessage } from '../src/shared/api/errors';
import type { ApiError } from '../src/shared/api/types';

describe('Frontend Error Normalization & Classification', () => {
  describe('isAbortError', () => {
    it('identifies DOMException AbortError', () => {
      const domError = new DOMException('The user aborted a request.', 'AbortError');
      expect(isAbortError(domError)).toBe(true);
    });

    it('identifies generic object with AbortError name', () => {
      expect(isAbortError({ name: 'AbortError' })).toBe(true);
    });

    it('returns false for normal errors', () => {
      expect(isAbortError(new Error('Network failure'))).toBe(false);
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError(undefined)).toBe(false);
      expect(isAbortError('AbortError')).toBe(false);
    });
  });

  describe('normalizeErrorMessage', () => {
    it('extracts message from standard Error', () => {
      expect(normalizeErrorMessage(new Error('Something broke'))).toBe('Something broke');
    });

    it('extracts message from ApiError with status and code', () => {
      const apiError = new Error('Invalid credentials') as ApiError;
      apiError.status = 401;
      apiError.code = 'INVALID_CREDENTIALS';
      expect(normalizeErrorMessage(apiError)).toBe('Invalid credentials');
    });

    it('handles direct string errors', () => {
      expect(normalizeErrorMessage('Direct error string')).toBe('Direct error string');
    });

    it('handles object with message property', () => {
      expect(normalizeErrorMessage({ message: 'Custom message' })).toBe('Custom message');
    });

    it('returns fallback message for empty/unknown errors', () => {
      expect(normalizeErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
      expect(normalizeErrorMessage(undefined, 'Custom fallback')).toBe('Custom fallback');
      expect(normalizeErrorMessage({}, 'Default fallback')).toBe('Default fallback');
    });
  });
});
