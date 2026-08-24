// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../shared/api/client';
import { AuthProvider, useAuth } from './useAuth';

const adminSession = {
  user: {
    id: 'acc_admin',
    displayName: 'Quản trị viên',
    role: 'ADMIN' as const,
    status: 'ACTIVE' as const,
    mustChangePassword: false,
  },
  expiresAt: '2026-08-25T10:00:00.000Z',
};

afterEach(() => {
  cleanup();
  apiClient.clearSessionCache();
  vi.unstubAllGlobals();
});

describe('apiClient', () => {
  it('includes cookies and caches one CSRF token for authenticated mutations', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { csrfToken: 'csrf-123' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { saved: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: { saved: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.patch('/users/me', { displayName: 'Tên mới' });
    await apiClient.patch('/users/me', { displayName: 'Tên khác' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/csrf-token');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      credentials: 'include',
      method: 'PATCH',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-123' }),
    });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      credentials: 'include',
      method: 'PATCH',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-123' }),
    });
  });
});

describe('useAuth', () => {
  it('bootstraps an anonymous session then logs in with the server user role', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(401, 'AUTHENTICATION_REQUIRED'))
      .mockResolvedValueOnce(jsonResponse({ data: adminSession }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    expect(await screen.findByRole('button', { name: 'login' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'login' }));

    expect(await screen.findByText('Quản trị viên — ADMIN')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/sessions');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'include', method: 'POST' });
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('X-CSRF-Token');
  });

  it('replaces authenticated UI with login when any feature request receives 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: adminSession }))
      .mockResolvedValueOnce(errorResponse(401, 'AUTHENTICATION_REQUIRED'));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText('Quản trị viên — ADMIN')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'expire feature request' }));

    expect(await screen.findByRole('button', { name: 'login' })).toBeInTheDocument();
  });
});

function AuthProbe() {
  const { isLoading, login, user } = useAuth();
  if (isLoading) return <p>loading</p>;
  if (!user) {
    return <button onClick={() => void login('admin@example.vn', 'Secret123')}>login</button>;
  }
  return (
    <>
      <p>{user.displayName} — {user.role}</p>
      <button onClick={() => void apiClient.get('/notifications').catch(() => undefined)}>
        expire feature request
      </button>
    </>
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse({
    error: { code, message: 'Request failed', requestId: 'req_test' },
  }, status);
}
