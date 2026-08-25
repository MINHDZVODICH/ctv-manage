// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsPopover } from './NotificationsPopover';
import { NotificationsProvider } from './useNotifications';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('NotificationsPopover', () => {
  it('loads the closed bell unread count once after authenticated UI mounts without polling', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=1') return Promise.resolve(json({ data: [notice('a', 'Một thông báo')], meta: { page: 1, pageSize: 1, total: 2 } }));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPopover();
    expect(await screen.findByRole('button', { name: /2 chưa đọc/i })).toBeVisible();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/v1/notifications?read=false&page=1&pageSize=1')).toHaveLength(1);
  });

  it('reports a selected mutation error and keeps notification state retryable', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=20') return Promise.resolve(json({ data: [notice('a', 'Không thể cập nhật')], meta: { page: 1, pageSize: 20, total: 1 } }));
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(json({ data: { csrfToken: 'csrf' } }));
      if (url === '/api/v1/notifications/a' && init?.method === 'PATCH') return Promise.resolve(json({ error: { code: 'SERVER_ERROR', message: 'Không thể cập nhật thông báo.' } }, 500));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPopover();
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
    renderPopover();
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
    renderPopover();
    await user.click(screen.getByRole('button', { name: /thông báo/i }));
    await user.selectOptions(await screen.findByLabelText(/lọc thông báo/i), 'true');
    await user.click(await screen.findByRole('button', { name: /đã đọc/i }));
    const patch = fetchMock.mock.calls.find(([url, init]) => url === '/api/v1/notifications/a' && init?.method === 'PATCH');
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ read: false });
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/notifications/b')).toBe(false);
  });

  it('loads the next page while preserving the selected read filter', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=20') return Promise.resolve(json({ data: Array.from({ length: 20 }, (_, index) => notice(`n-${index}`, `N${index}`)), meta: { page: 1, pageSize: 20, total: 21 } }));
      if (url === '/api/v1/notifications?read=false&page=2&pageSize=20') return Promise.resolve(json({ data: [notice('n-20', 'N20')], meta: { page: 2, pageSize: 20, total: 21 } }));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPopover();
    await user.click(screen.getByRole('button', { name: /thông báo/i }));
    await user.click(await screen.findByRole('button', { name: /trang sau/i }));
    expect(await screen.findByText('N20')).toBeVisible();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/notifications?read=false&page=2&pageSize=20')).toBe(true);
  });

  it('keeps the newest filter and page when an older list request fails later', async () => {
    const oldUnreadPage = deferred<Response>();
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=1') return Promise.resolve(json({ data: [], meta: { page: 1, pageSize: 1, total: 0 } }));
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=20') return oldUnreadPage.promise;
      if (url === '/api/v1/notifications?read=true&page=1&pageSize=20') return Promise.resolve(json({ data: Array.from({ length: 20 }, (_, index) => ({ ...notice(`read-${index}`, `Đã đọc ${index}`), read: true })), meta: { page: 1, pageSize: 20, total: 21 } }));
      if (url === '/api/v1/notifications?read=true&page=2&pageSize=20') return Promise.resolve(json({ data: [{ ...notice('fresh', 'Trang mới nhất'), read: true }], meta: { page: 2, pageSize: 20, total: 21 } }));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole('button', { name: /thông báo/i }));
    await user.selectOptions(screen.getByLabelText(/lọc thông báo/i), 'true');
    await user.click(await screen.findByRole('button', { name: /trang sau/i }));
    expect(await screen.findByText('Trang mới nhất')).toBeVisible();

    oldUnreadPage.resolve(json({ error: { code: 'SERVER_ERROR', message: 'Phản hồi cũ.' } }, 500));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByLabelText(/lọc thông báo/i)).toHaveValue('true');
    expect(screen.getByText('Trang 2/2')).toBeVisible();
    expect(screen.getByText('Trang mới nhất')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Đang tải thông báo...')).not.toBeInTheDocument();
  });

  it('keeps the newest unread count when a bootstrap response resolves after a mutation refresh', async () => {
    const bootstrap = deferred<Response>(); let countRequests = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=1') {
        countRequests += 1;
        return countRequests === 1 ? bootstrap.promise : Promise.resolve(json({ data: [], meta: { page: 1, pageSize: 1, total: 1 } }));
      }
      if (url === '/api/v1/notifications?read=false&page=1&pageSize=20') return Promise.resolve(json({ data: [notice('a', 'Đọc rồi')], meta: { page: 1, pageSize: 20, total: 2 } }));
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(json({ data: { csrfToken: 'csrf' } }));
      if (url === '/api/v1/notifications/a' && init?.method === 'PATCH') return Promise.resolve(json({ data: { ...notice('a', 'Đọc rồi'), read: true } }));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole('button', { name: /thông báo/i }));
    await user.click(await screen.findByRole('button', { name: /đọc rồi/i }));
    expect(await screen.findByRole('button', { name: /1 chưa đọc/i })).toBeVisible();

    bootstrap.resolve(json({ data: [], meta: { page: 1, pageSize: 1, total: 2 } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('button', { name: /1 chưa đọc/i })).toBeVisible();
  });

  it('does not leak an older account unread response after the provider account changes', async () => {
    const oldAccountCount = deferred<Response>();
    let countRequests = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url !== '/api/v1/notifications?read=false&page=1&pageSize=1') return Promise.resolve(json({}, 404));
      countRequests += 1;
      return countRequests === 1 ? oldAccountCount.promise : Promise.resolve(json({ data: [], meta: { page: 1, pageSize: 1, total: 1 } }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<NotificationsProvider accountId="account-a"><NotificationsPopover /></NotificationsProvider>);
    view.rerender(<NotificationsProvider accountId="account-b"><NotificationsPopover /></NotificationsProvider>);
    expect(await screen.findByRole('button', { name: /1 chưa đọc/i })).toBeVisible();

    oldAccountCount.resolve(json({ data: [], meta: { page: 1, pageSize: 1, total: 2 } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('button', { name: /1 chưa đọc/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /2 chưa đọc/i })).not.toBeInTheDocument();
  });
});
function notice(id: string, title: string) { return { id, type: 'REGISTRATION_APPROVED', title, message: 'Nội dung', read: false, createdAt: '2026-08-24T00:00:00.000Z' }; }
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function renderPopover() { return render(<NotificationsProvider accountId="account-test"><NotificationsPopover /></NotificationsProvider>); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((fulfill) => { resolve = fulfill; }); return { promise, resolve }; }
