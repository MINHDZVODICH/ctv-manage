import type { ApiErrorEnvelope, ApiSuccess, CsrfTokenData } from './contracts';
import { ApiClientError } from './errors';

const API_ROOT = '/api/v1';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface RequestOptions {
  method?: string;
  body?: unknown;
  csrf?: boolean;
  idempotencyKey?: string;
}

type UnauthorizedListener = () => void;

class ApiClient {
  private csrfToken?: string;
  private csrfRequest?: Promise<string>;
  private readonly unauthorizedListeners = new Set<UnauthorizedListener>();

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  postMultipart<T>(path: string, body: FormData, idempotencyKey: string): Promise<T> {
    return this.request<T>(path, { method: 'POST', body, csrf: false, idempotencyKey });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  delete(path: string): Promise<void> {
    return this.request<void>(path, { method: 'DELETE' });
  }

  clearSessionCache(): void {
    this.csrfToken = undefined;
    this.csrfRequest = undefined;
  }

  onUnauthorized(listener: UnauthorizedListener): () => void {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const isPublicMutation = method === 'POST'
      && (path === '/auth/sessions' || path === '/registration-requests');
    const needsCsrf = options.csrf ?? (!SAFE_METHODS.has(method) && !isPublicMutation);
    const headers: Record<string, string> = { Accept: 'application/json' };
    const isMultipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (options.body !== undefined && !isMultipart) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (needsCsrf) headers['X-CSRF-Token'] = await this.getCsrfToken();

    const response = await fetch(`${API_ROOT}${path}`, {
      method,
      credentials: 'include',
      headers,
      ...(options.body === undefined ? {} : {
        body: (isMultipart ? options.body as FormData : JSON.stringify(options.body)) as BodyInit,
      }),
    });

    if (response.status === 204) return undefined as T;
    const payload = await parseJson(response);
    if (!response.ok) {
      if (response.status === 401) {
        this.clearSessionCache();
        for (const listener of this.unauthorizedListeners) listener();
      }
      const envelope = payload as ApiErrorEnvelope;
      throw new ApiClientError(response.status, envelope.error ?? {
        code: 'UNEXPECTED_RESPONSE',
        message: 'Máy chủ trả về phản hồi không hợp lệ.',
      });
    }
    if (method === 'POST' && path === '/auth/sessions') this.clearSessionCache();
    return (payload as ApiSuccess<T>).data;
  }

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    if (!this.csrfRequest) {
      this.csrfRequest = this.request<CsrfTokenData>('/auth/csrf-token', { method: 'GET', csrf: false })
        .then(({ csrfToken }) => {
          this.csrfToken = csrfToken;
          return csrfToken;
        })
        .finally(() => {
          this.csrfRequest = undefined;
        });
    }
    return this.csrfRequest;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiClientError(response.status, {
      code: 'UNEXPECTED_RESPONSE',
      message: 'Máy chủ trả về phản hồi không hợp lệ.',
    });
  }
}

export const apiClient = new ApiClient();
