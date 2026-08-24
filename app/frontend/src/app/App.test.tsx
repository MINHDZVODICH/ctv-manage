// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
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
