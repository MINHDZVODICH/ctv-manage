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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
