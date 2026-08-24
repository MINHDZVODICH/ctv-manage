// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../shared/api/client';
import { App } from './App';

const adminSession = {
  user: {
    id: 'acc_admin',
    displayName: 'Quản trị viên',
    role: 'ADMIN',
    status: 'ACTIVE',
    mustChangePassword: false,
  },
  expiresAt: '2026-08-25T10:00:00.000Z',
};

afterEach(() => {
  cleanup();
  apiClient.clearSessionCache();
  vi.unstubAllGlobals();
});

it('renders Admin navigation from the current server session without role switching or meetings', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: adminSession })));

  render(<App />);

  expect(await screen.findByRole('button', { name: /quản lý tài khoản/i })).toBeVisible();
  expect(screen.getByRole('button', { name: /duyệt hồ sơ/i })).toBeVisible();
  expect(screen.getByRole('button', { name: /lịch làm việc tổng hợp/i })).toBeVisible();
  expect(screen.queryByText(/chuyển vai trò/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/cuộc họp|phiên họp/i)).not.toBeInTheDocument();
});

it('renders only CTV navigation when the current session role is CTV', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
    data: {
      ...adminSession,
      user: { ...adminSession.user, id: 'acc_ctv', displayName: 'Nguyễn Văn A', role: 'CTV' },
    },
  })));

  render(<App />);

  expect(await screen.findByRole('button', { name: /lịch làm việc của tôi/i })).toBeVisible();
  expect(screen.getByRole('heading', { name: /lịch làm việc của tôi/i })).toBeVisible();
  expect(screen.queryByRole('button', { name: /quản lý tài khoản/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /duyệt hồ sơ/i })).not.toBeInTheDocument();
});

it('clears authenticated UI only after logout succeeds', async () => {
  const logout = deferred<Response>();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ data: adminSession }))
    .mockResolvedValueOnce(jsonResponse({ data: { csrfToken: 'csrf-123' } }))
    .mockImplementationOnce(() => logout.promise);
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();

  render(<App />);
  await user.click(await screen.findByRole('button', { name: /đăng xuất/i }));

  expect(screen.getByRole('button', { name: /quản lý tài khoản/i })).toBeVisible();
  logout.resolve(new Response(null, { status: 204 }));
  expect(await screen.findByRole('heading', { name: /đăng nhập/i })).toBeVisible();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}
