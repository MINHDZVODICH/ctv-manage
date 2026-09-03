const BASE = '';

export function isRequestAborted(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers as any) },
    ...init,
  });
  if (res.status === 204) return undefined as unknown as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error?.message || body?.message || res.statusText);
    err.status = res.status;
    err.code = body?.error?.code;
    err.details = body;
    throw err;
  }
  return body as T;
}

export function apiGet<T>(path: string, options: RequestInit = {}) {
  return request<T>(path, { ...options, method: 'GET' });
}
export function apiPost<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined });
}
export function apiPatch<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(data) });
}
export function apiPut<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(data) });
}
export function apiDelete<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

export async function apiUpload<T>(path: string, form: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method, body: form, credentials: 'include' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error?.message || res.statusText);
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
