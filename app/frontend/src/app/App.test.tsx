// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
});

it('opens and closes a navigation drawer from the mobile top bar at 390x844', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: adminSession })));
  const user = userEvent.setup();

  render(<App />);
  await screen.findByRole('button', { name: /quản lý tài khoản/i });
  await user.click(screen.getByRole('button', { name: /mở danh mục/i }));

  const drawer = screen.getByRole('dialog', { name: /danh mục điều hướng/i });
  expect(within(drawer).getByRole('button', { name: /quản lý tài khoản/i })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /đóng danh mục/i }));
  expect(screen.queryByRole('dialog', { name: /danh mục điều hướng/i })).not.toBeInTheDocument();
});

it('bootstraps the unread count once in StrictMode and does not repeat it when the drawer opens', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/v1/auth/sessions/current') return Promise.resolve(jsonResponse({ data: adminSession }));
    if (url === '/api/v1/notifications?read=false&page=1&pageSize=1') return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 1, total: 2 } }));
    if (url.startsWith('/api/v1/accounts?')) return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 5, total: 0 } }));
    return Promise.resolve(errorResponse(404, 'NOT_FOUND'));
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();

  render(<StrictMode><App /></StrictMode>);
  await screen.findByRole('button', { name: /quản lý tài khoản/i });
  await screen.findByRole('button', { name: /2 chưa đọc/i });
  expect(unreadBootstrapCalls(fetchMock)).toBe(1);

  await user.click(screen.getByRole('button', { name: /mở danh mục/i }));
  expect(await screen.findAllByRole('button', { name: /2 chưa đọc/i })).toHaveLength(2);
  expect(unreadBootstrapCalls(fetchMock)).toBe(1);
});

it('shares notification mutations between the desktop sidebar and mobile drawer', async () => {
  let markedRead = false;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/v1/auth/sessions/current') return Promise.resolve(jsonResponse({ data: adminSession }));
    if (url === '/api/v1/notifications?read=false&page=1&pageSize=1') return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 1, total: markedRead ? 1 : 2 } }));
    if (url === '/api/v1/notifications?read=false&page=1&pageSize=20') return Promise.resolve(jsonResponse({ data: markedRead ? [] : [notification('a', 'Một thông báo')], meta: { page: 1, pageSize: 20, total: markedRead ? 1 : 2 } }));
    if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf' } }));
    if (url === '/api/v1/notifications/a' && init?.method === 'PATCH') { markedRead = true; return Promise.resolve(jsonResponse({ data: { ...notification('a', 'Một thông báo'), read: true } })); }
    if (url.startsWith('/api/v1/accounts?')) return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 5, total: 0 } }));
    return Promise.resolve(errorResponse(404, 'NOT_FOUND'));
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();

  render(<App />);
  await user.click(await screen.findByRole('button', { name: /mở danh mục/i }));
  const bells = await screen.findAllByRole('button', { name: /2 chưa đọc/i });
  await user.click(bells[0]);
  await user.click(await screen.findByRole('button', { name: /một thông báo/i }));

  expect(await screen.findAllByRole('button', { name: /1 chưa đọc/i })).toHaveLength(2);
  expect(unreadBootstrapCalls(fetchMock)).toBe(2);
});

it('shares the selected notification filter between desktop and mobile popovers', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/v1/auth/sessions/current') return Promise.resolve(jsonResponse({ data: adminSession }));
    if (url === '/api/v1/notifications?read=false&page=1&pageSize=1') return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 1, total: 2 } }));
    if (url === '/api/v1/notifications?read=false&page=1&pageSize=20') return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 20, total: 2 } }));
    if (url === '/api/v1/notifications?read=true&page=1&pageSize=20') return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 20, total: 0 } }));
    if (url.startsWith('/api/v1/accounts?')) return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 5, total: 0 } }));
    return Promise.resolve(errorResponse(404, 'NOT_FOUND'));
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();

  render(<App />);
  await user.click(await screen.findByRole('button', { name: /mở danh mục/i }));
  const bells = await screen.findAllByRole('button', { name: /2 chưa đọc/i });
  await user.click(bells[0]);
  await user.click(bells[1]);
  const filters = await screen.findAllByLabelText(/lọc thông báo/i);
  await user.selectOptions(filters[0], 'true');

  expect(filters[1]).toHaveValue('true');
});

it('bootstraps fresh notification state once after logout then login as a different account', async () => {
  let loginCount = 0;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/v1/auth/sessions/current') return Promise.resolve(errorResponse(401, 'AUTHENTICATION_REQUIRED'));
    if (url === '/api/v1/auth/sessions' && init?.method === 'POST') {
      loginCount += 1;
      const user = loginCount === 1 ? adminSession.user : { ...adminSession.user, id: 'acc_ctv', displayName: 'CTV mới', role: 'CTV' as const };
      return Promise.resolve(jsonResponse({ data: { user, expiresAt: `2026-08-25T1${loginCount}:00:00.000Z` } }, 201));
    }
    if (url === '/api/v1/notifications?read=false&page=1&pageSize=1') {
      return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 1, total: loginCount === 1 ? 2 : 1 } }));
    }
    if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf' } }));
    if (url === '/api/v1/auth/sessions/current' && init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
    if (url.startsWith('/api/v1/accounts?')) return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 5, total: 0 } }));
    return Promise.resolve(errorResponse(404, 'NOT_FOUND'));
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();

  render(<StrictMode><App /></StrictMode>);
  await login(user, 'admin@example.vn');
  expect(await screen.findByRole('button', { name: /2 chưa đọc/i })).toBeVisible();
  expect(unreadBootstrapCalls(fetchMock)).toBe(1);
  await user.click(screen.getByRole('button', { name: /mở menu tài khoản/i }));
  await user.click(screen.getByRole('menuitem', { name: /đăng xuất/i }));
  await screen.findByRole('heading', { name: /đăng nhập/i });

  await login(user, 'ctv@example.vn');
  expect(await screen.findByRole('button', { name: /1 chưa đọc/i })).toBeVisible();
  expect(unreadBootstrapCalls(fetchMock)).toBe(2);
});

it('collapses and expands the desktop sidebar', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: adminSession })));
  const user = userEvent.setup();

  render(<App />);
  const sidebar = await screen.findByRole('complementary');
  await user.click(screen.getByRole('button', { name: /thu gọn thanh bên/i }));

  expect(sidebar).toHaveClass('collapsed');
  expect(screen.getByRole('button', { name: /mở rộng thanh bên/i })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /mở rộng thanh bên/i }));
  expect(sidebar).not.toHaveClass('collapsed');
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
  expect(await screen.findByRole('heading', { name: /lịch làm việc của tôi/i })).toBeVisible();
  expect(screen.queryByRole('button', { name: /quản lý tài khoản/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /duyệt hồ sơ/i })).not.toBeInTheDocument();
});

it('clears authenticated UI only after logout succeeds', async () => {
  const logout = deferred<Response>();
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/v1/auth/sessions/current' && init?.method === 'DELETE') return logout.promise;
    if (url === '/api/v1/auth/sessions/current') return Promise.resolve(jsonResponse({ data: adminSession }));
    if (url === '/api/v1/notifications?read=false&page=1&pageSize=1') return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 1, total: 0 } }));
    if (url.startsWith('/api/v1/accounts?')) return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 5, total: 0 } }));
    if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf-123' } }));
    return Promise.resolve(errorResponse(404, 'NOT_FOUND'));
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();

  render(<App />);
  await user.click(await screen.findByRole('button', { name: /mở menu tài khoản/i }));
  await user.click(screen.getByRole('menuitem', { name: /đăng xuất/i }));

  expect(screen.getByRole('button', { name: /quản lý tài khoản/i })).toBeVisible();
  logout.resolve(new Response(null, { status: 204 }));
  expect(await screen.findByRole('heading', { name: /đăng nhập/i })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Đã đăng xuất khỏi hệ thống');
});

it('shows and hides the login password', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(401, 'AUTHENTICATION_REQUIRED')));
  const user = userEvent.setup();

  render(<App />);
  const password = await screen.findByLabelText('Mật khẩu');
  expect(password).toHaveAttribute('type', 'password');

  await user.click(screen.getByRole('button', { name: /hiện mật khẩu/i }));
  expect(password).toHaveAttribute('type', 'text');
  await user.click(screen.getByRole('button', { name: /ẩn mật khẩu/i }));
  expect(password).toHaveAttribute('type', 'password');
});

it('shows a success notification after login', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(errorResponse(401, 'AUTHENTICATION_REQUIRED'))
    .mockResolvedValueOnce(jsonResponse({ data: adminSession }, 201));
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();

  render(<App />);
  await user.type(await screen.findByLabelText('Email'), 'admin@example.vn');
  await user.type(screen.getByLabelText('Mật khẩu'), 'Secret123');
  await user.click(screen.getByRole('button', { name: /^đăng nhập$/i }));

  expect(await screen.findByRole('status')).toHaveTextContent('Đăng nhập thành công với admin@example.vn');
  expect(screen.getByRole('button', { name: /quản lý tài khoản/i })).toBeVisible();
});

it('opens an account popover with Profile, Settings, and Logout but no role switch', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: adminSession })));
  const user = userEvent.setup();

  render(<App />);
  await user.click(await screen.findByRole('button', { name: /mở menu tài khoản của quản trị viên/i }));

  const menu = screen.getByRole('menu', { name: /tùy chọn tài khoản/i });
  expect(within(menu).getByRole('menuitem', { name: /thông tin tài khoản/i })).toBeVisible();
  expect(within(menu).getByRole('menuitem', { name: /cài đặt/i })).toBeVisible();
  expect(within(menu).getByRole('menuitem', { name: /đăng xuất/i })).toBeVisible();
  expect(within(menu).queryByText(/chuyển vai trò/i)).not.toBeInTheDocument();

  await user.click(within(menu).getByRole('menuitem', { name: /cài đặt/i }));
  expect(screen.getByRole('dialog', { name: /cài đặt hệ thống/i })).toBeVisible();
});

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

function unreadBootstrapCalls(fetchMock: ReturnType<typeof vi.fn>): number {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/v1/notifications?read=false&page=1&pageSize=1').length;
}

function notification(id: string, title: string) {
  return { id, type: 'REGISTRATION_APPROVED', title, message: 'Nội dung', read: false, createdAt: '2026-08-24T00:00:00.000Z' };
}

async function login(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Mật khẩu'), 'Secret123');
  await user.click(screen.getByRole('button', { name: /^đăng nhập$/i }));
}
