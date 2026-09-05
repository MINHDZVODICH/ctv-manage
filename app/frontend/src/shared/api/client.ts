import type { ApiError } from './types';

const BASE = '';

export function isRequestAborted(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    },
    ...init,
  });

  if (res.status === 204) return undefined as unknown as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || body?.message || res.statusText) as ApiError;
    err.status = res.status;
    err.code = body?.error?.code;
    err.details = body;
    throw err;
  }
  return body as T;
}

export function apiGet<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'GET' });
}

export function apiPost<T>(path: string, data?: unknown, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    ...options,
    method: 'POST',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

export function apiPatch<T>(path: string, data?: unknown, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function apiPut<T>(path: string, data?: unknown, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function apiDelete<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'DELETE' });
}

export async function apiUpload<T>(
  path: string,
  form: FormData,
  method: 'POST' | 'PUT' = 'POST',
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    method,
    body: form,
    credentials: 'include',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || res.statusText) as ApiError;
    err.status = res.status;
    err.code = body?.error?.code;
    err.details = body;
    throw err;
  }
  return body as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Download failed');
  return res.blob();
}
