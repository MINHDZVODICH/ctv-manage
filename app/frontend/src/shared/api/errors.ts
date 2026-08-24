import type { ApiErrorBody } from './contracts';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(status: number, error: ApiErrorBody) {
    super(error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
  }
}
