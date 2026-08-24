// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../shared/api/client';
import { AccountListScreen } from './AccountListScreen';

afterEach(() => {
  cleanup();
  apiClient.clearSessionCache();
  vi.unstubAllGlobals();
});

describe('AccountListScreen', () => {
  it('edits a CTV profile with its current version then reloads detail and the preserved list query', async () => {
    let detailLoads = 0;
    const queries: string[] = [];
    const account = summary('acc_edit', 'Nguyễn Văn An');
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/v1/accounts?')) { queries.push(url); return Promise.resolve(jsonResponse({ data: [account], meta: { page: 1, pageSize: 5, total: 1 } })); }
      if (url === '/api/v1/accounts/acc_edit' && (!init?.method || init.method === 'GET')) { detailLoads += 1; return Promise.resolve(jsonResponse({ data: detail(account, detailLoads > 1 ? 'Tên mới' : account.displayName) })); }
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf-edit' } }));
      if (url === '/api/v1/accounts/acc_edit' && init?.method === 'PATCH') return Promise.resolve(jsonResponse({ data: detail({ ...account, version: 2 }, 'Tên mới') }));
      return Promise.resolve(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<AccountListScreen />);
    await user.type(await screen.findByPlaceholderText(/họ tên/i), 'An');
    await user.click(screen.getByRole('button', { name: /tìm kiếm/i }));
    await user.click(await screen.findByRole('button', { name: /xem hồ sơ/i }));
    await user.click(await screen.findByRole('button', { name: /chỉnh sửa thông tin/i }));
    const name = screen.getByLabelText(/họ và tên/i);
    await user.clear(name); await user.type(name, 'Tên mới');
    await user.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => expect(detailLoads).toBe(2));
    const patchCall = fetchMock.mock.calls.find((call) => call[0] === '/api/v1/accounts/acc_edit' && call[1]?.method === 'PATCH');
    expect(JSON.parse(patchCall?.[1]?.body as string)).toMatchObject({ displayName: 'Tên mới', version: 1 });
    expect(queries.at(-1)).toContain('q=An');
    expect(queries.at(-1)).toContain('pageSize=5');
  });

  it('validates reset confirmation and reuses its key after an unknown failure', async () => {
    const account = summary('acc_reset', 'CTV Reset');
    const resetCalls: Array<{ key: string; body: string }> = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/v1/accounts?')) return Promise.resolve(jsonResponse({ data: [account], meta: { page: 1, pageSize: 5, total: 1 } }));
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf-reset' } }));
      if (url === '/api/v1/accounts/acc_reset/password-resets') {
        resetCalls.push({ key: String((init?.headers as Record<string, string>)['Idempotency-Key']), body: String(init?.body) });
        if (resetCalls.length <= 2) return Promise.reject(new TypeError('connection lost'));
        return Promise.resolve(jsonResponse({ data: { accountId: account.id } }));
      }
      return Promise.resolve(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<AccountListScreen />);
    await user.click(await screen.findByLabelText(/đặt lại mật khẩu ctv reset/i));
    const password = screen.getByLabelText(/^mật khẩu mặc định mới$/i);
    const confirmation = screen.getByLabelText(/xác nhận mật khẩu/i);
    expect(password).toHaveAttribute('type', 'password');
    expect(confirmation).toHaveAttribute('type', 'password');
    await user.type(confirmation, 'không-khớp');
    await user.click(screen.getByRole('button', { name: /^xác nhận$/i }));
    expect(resetCalls).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent(/không khớp/i);
    await user.clear(confirmation); await user.type(confirmation, 'CTV@123456');
    await user.click(screen.getByRole('button', { name: /^xác nhận$/i }));
    expect((await screen.findAllByText(/không thể kết nối/i)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /^xác nhận$/i }));
    await waitFor(() => expect(resetCalls).toHaveLength(2));
    expect(resetCalls[1].key).toBe(resetCalls[0].key);
    await user.clear(password); await user.type(password, 'Changed123');
    await user.clear(confirmation); await user.type(confirmation, 'Changed123');
    await user.click(screen.getByRole('button', { name: /^xác nhận$/i }));
    await waitFor(() => expect(resetCalls).toHaveLength(3));
    expect(resetCalls[2].key).not.toBe(resetCalls[1].key);
    await user.click(await screen.findByLabelText(/đặt lại mật khẩu ctv reset/i));
    await user.type(screen.getByLabelText(/xác nhận mật khẩu/i), 'CTV@123456');
    await user.click(screen.getByRole('button', { name: /^xác nhận$/i }));
    await waitFor(() => expect(resetCalls).toHaveLength(4));
    expect(resetCalls[3].key).not.toBe(resetCalls[0].key);
  });

  it('reloads detail and list on a version conflict without reporting a successful overwrite', async () => {
    let detailLoads = 0;
    let listLoads = 0;
    const account = summary('acc_conflict', 'CTV Conflict');
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/v1/accounts?')) { listLoads += 1; return Promise.resolve(jsonResponse({ data: [{ ...account, version: listLoads > 1 ? 2 : 1 }], meta: { page: 1, pageSize: 5, total: 1 } })); }
      if (url === '/api/v1/accounts/acc_conflict' && (!init?.method || init.method === 'GET')) { detailLoads += 1; return Promise.resolve(jsonResponse({ data: detail({ ...account, version: detailLoads > 1 ? 2 : 1 }, detailLoads > 1 ? 'Tên từ máy chủ' : account.displayName) })); }
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf-conflict' } }));
      if (url === '/api/v1/accounts/acc_conflict' && init?.method === 'PATCH') return Promise.resolve(jsonResponse({ error: { code: 'VERSION_CONFLICT', message: 'Conflict' } }, 409));
      return Promise.resolve(jsonResponse({}, 404));
    }));
    const user = userEvent.setup();
    render(<AccountListScreen />);
    await user.click(await screen.findByRole('button', { name: /xem hồ sơ/i }));
    await user.click(await screen.findByRole('button', { name: /chỉnh sửa thông tin/i }));
    await user.click(screen.getByRole('button', { name: /lưu thay đổi/i }));
    expect(await screen.findByText(/dữ liệu đã thay đổi/i)).toBeVisible();
    await waitFor(() => expect(detailLoads).toBe(2));
    expect(listLoads).toBe(2);
    expect(screen.queryByText(/đã cập nhật thông tin/i)).not.toBeInTheDocument();
  });
  it('keeps server pagination and search when an account status changes', async () => {
    const account = {
      id: 'acc_1', displayName: 'Nguyễn Văn An', email: 'an@example.vn', phone: '0900000000',
      ctvCode: 'CTV-001', status: 'ACTIVE', version: 1, joinedAt: '2026-01-01T00:00:00.000Z', avatarFileId: null,
    };
    const accountQueries: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/v1/accounts?')) {
        accountQueries.push(url);
        return Promise.resolve(jsonResponse({ data: [account], meta: { page: 1, pageSize: 5, total: 1 } }));
      }
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf-1' } }));
      if (url === '/api/v1/accounts/acc_1/status' && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({ data: { ...account, status: 'DISABLED', version: 2 } }));
      }
      return Promise.resolve(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<AccountListScreen />);
    await screen.findByText('Nguyễn Văn An');
    await user.type(screen.getByPlaceholderText(/họ tên/i), 'An');
    await user.click(screen.getByRole('button', { name: /tìm kiếm/i }));
    await user.click(await screen.findByTitle(/vô hiệu hóa/i));
    await user.click(screen.getByRole('button', { name: /^vô hiệu hóa$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/accounts/acc_1/status',
      expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-1' }) }),
    ));
    await waitFor(() => expect(accountQueries.at(-1)).toContain('q=An'));
    expect(accountQueries.at(-1)).toContain('page=1');
    expect(accountQueries.at(-1)).toContain('pageSize=5');
  });

  it('opens server detail and never renders credential or storage fields', async () => {
    const summary = {
      id: 'acc_2', displayName: 'Trần Thị Bình', email: 'binh@example.vn', phone: null,
      ctvCode: 'CTV-002', status: 'ACTIVE', version: 1, joinedAt: null, avatarFileId: null,
    };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/api/v1/accounts?')) return Promise.resolve(jsonResponse({ data: [summary], meta: { page: 1, pageSize: 5, total: 1 } }));
      if (url === '/api/v1/accounts/acc_2') return Promise.resolve(jsonResponse({ data: {
        ...summary, role: 'CTV', dateOfBirth: null, gender: null, address: null, adminNotes: null,
        mustChangePassword: false, lastLoginAt: null, createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z', files: [{
          id: 'file_1', category: 'CV', originalName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 1024,
          createdAt: '2026-01-01T00:00:00.000Z',
        }],
      } }));
      return Promise.resolve(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
    }));
    const user = userEvent.setup();

    render(<AccountListScreen />);
    await user.click(await screen.findByRole('button', { name: /xem hồ sơ trần thị bình/i }));
    const dialog = await screen.findByRole('dialog', { name: /hồ sơ.*trần thị bình/i });
    expect(dialog).toHaveTextContent('cv.pdf');
    expect(dialog).not.toHaveTextContent(/passwordHash|storageKey/i);
  });
});

function summary(id: string, displayName: string) {
  return { id, displayName, email: `${id}@example.vn`, phone: '0900000000', ctvCode: 'CTV-001', status: 'ACTIVE', version: 1, joinedAt: '2026-01-01T00:00:00.000Z', avatarFileId: null };
}

function detail(account: ReturnType<typeof summary>, displayName: string) {
  return { ...account, displayName, role: 'CTV', dateOfBirth: null, gender: null, address: null, adminNotes: null, mustChangePassword: false, lastLoginAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', files: [] };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
