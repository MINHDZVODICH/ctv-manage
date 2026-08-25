// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsPopover } from './NotificationsPopover';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('NotificationsPopover', () => {
  it('reports a selected mutation error and keeps notification state retryable', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=20') return Promise.resolve(json({ data: [notice('a', 'Không thể cập nhật')], meta: { page: 1, pageSize: 20, total: 1 } }));
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(json({ data: { csrfToken: 'csrf' } }));
      if (url === '/api/v1/notifications/a' && init?.method === 'PATCH') return Promise.resolve(json({ error: { code: 'SERVER_ERROR', message: 'Không thể cập nhật thông báo.' } }, 500));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<NotificationsPopover />);
    await user.click(screen.getByRole('button', { name: /thông báo/i }));
    await user.click(await screen.findByRole('button', { name: /không thể cập nhật/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/không thể cập nhật thông báo/i);
  });

  it('marks only the selected notification as read', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=20') return Promise.resolve(json({ data: [notice('a', 'Hồ sơ đã được duyệt'), notice('b', 'Thông báo khác')], meta: { page: 1, pageSize: 20, total: 2 } }));
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(json({ data: { csrfToken: 'csrf' } }));
      if (url === '/api/v1/notifications/a' && init?.method === 'PATCH') return Promise.resolve(json({ data: { ...notice('a', 'Hồ sơ đã được duyệt'), read: true } }));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<NotificationsPopover />);
    await user.click(screen.getByRole('button', { name: /thông báo/i }));
    await user.click(await screen.findByRole('button', { name: /hồ sơ đã được duyệt/i }));
    const patch = fetchMock.mock.calls.find(([url, init]) => url === '/api/v1/notifications/a' && init?.method === 'PATCH');
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ read: true });
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/notifications/b')).toBe(false);
  });

  it('marks a selected read notification as unread without changing another item', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=20') return Promise.resolve(json({ data: [], meta: { page: 1, pageSize: 20, total: 0 } }));
      if (url === '/api/v1/notifications?read=true&page=1&pageSize=20') return Promise.resolve(json({ data: [{ ...notice('a', 'Đã đọc'), read: true }, { ...notice('b', 'Không đổi'), read: true }], meta: { page: 1, pageSize: 20, total: 2 } }));
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(json({ data: { csrfToken: 'csrf' } }));
      if (url === '/api/v1/notifications/a' && init?.method === 'PATCH') return Promise.resolve(json({ data: { ...notice('a', 'Đã đọc'), read: false } }));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<NotificationsPopover />);
    await user.click(screen.getByRole('button', { name: /thông báo/i }));
    await user.selectOptions(await screen.findByLabelText(/lọc thông báo/i), 'true');
    await user.click(await screen.findByRole('button', { name: /đã đọc/i }));
    const patch = fetchMock.mock.calls.find(([url, init]) => url === '/api/v1/notifications/a' && init?.method === 'PATCH');
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ read: false });
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/notifications/b')).toBe(false);
  });
});
function notice(id: string, title: string) { return { id, type: 'REGISTRATION_APPROVED', title, message: 'Nội dung', read: false, createdAt: '2026-08-24T00:00:00.000Z' }; }
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
