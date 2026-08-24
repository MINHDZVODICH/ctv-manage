// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../shared/api/client';
import { ProfileScreen } from './ProfileScreen';

afterEach(() => {
  cleanup();
  apiClient.clearSessionCache();
  vi.unstubAllGlobals();
});

describe('ProfileScreen', () => {
  it('updates a profile file through the authorized endpoint and reloads metadata', async () => {
    let profileLoads = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/v1/users/me' && (!init?.method || init.method === 'GET')) {
        profileLoads += 1;
        return Promise.resolve(jsonResponse({ data: profile(profileLoads > 1 ? 'file_new' : null) }));
      }
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf-profile' } }));
      if (url === '/api/v1/users/me/files/avatar' && init?.method === 'PUT') {
        expect(init.body).toBeInstanceOf(FormData);
        expect((init.body as FormData).get('file')).toBeInstanceOf(File);
        return Promise.resolve(jsonResponse({ data: {
          id: 'file_new', category: 'AVATAR', originalName: 'avatar.png', mimeType: 'image/png', sizeBytes: 8,
          createdAt: '2026-08-25T10:00:00.000Z',
        } }));
      }
      return Promise.resolve(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<ProfileScreen />);
    expect((await screen.findAllByText('Nguyễn Văn An')).length).toBeGreaterThan(0);
    const avatarFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'avatar.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/ảnh đại diện/i), avatarFile);

    expect(await screen.findByText(/thay đổi ảnh đại diện thành công/i)).toBeVisible();
    await waitFor(() => expect(profileLoads).toBe(2));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/me/files/avatar', expect.objectContaining({
      method: 'PUT', headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-profile' }),
    }));
  });

  it('sends the current password for a password change and clears the dialog on success', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/v1/users/me' && (!init?.method || init.method === 'GET')) return Promise.resolve(jsonResponse({ data: profile(null) }));
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf-profile' } }));
      if (url === '/api/v1/users/me/password-changes') return Promise.resolve(jsonResponse({ data: {
        accountId: 'acc_1', mustChangePassword: false, changedAt: '2026-08-25T10:00:00.000Z', revokedSessionCount: 1,
      } }));
      return Promise.resolve(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<ProfileScreen />);
    await user.click(await screen.findByRole('button', { name: /đổi mật khẩu/i }));
    await user.type(screen.getByLabelText(/mật khẩu hiện tại/i), 'Secret123');
    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), 'Changed123');
    await user.type(screen.getByLabelText(/xác nhận mật khẩu mới/i), 'Changed123');
    await user.click(screen.getByRole('button', { name: /^đổi mật khẩu$/i }));

    expect(await screen.findByText(/đổi mật khẩu thành công/i)).toBeVisible();
    const call = fetchMock.mock.calls.find((entry) => entry[0] === '/api/v1/users/me/password-changes');
    expect(JSON.parse(call?.[1]?.body as string)).toEqual({ currentPassword: 'Secret123', newPassword: 'Changed123' });
  });
});

function profile(avatarFileId: string | null) {
  return {
    id: 'acc_1', displayName: 'Nguyễn Văn An', email: 'an@example.vn', phone: '0900000000', ctvCode: 'CTV-001',
    status: 'ACTIVE', version: 1, joinedAt: '2026-01-01T00:00:00.000Z', avatarFileId, role: 'CTV',
    dateOfBirth: '2000-01-01', gender: 'MALE', address: 'Hà Nội', adminNotes: null, mustChangePassword: false,
    lastLoginAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    files: avatarFileId ? [{ id: avatarFileId, category: 'AVATAR', originalName: 'avatar.png', mimeType: 'image/png', sizeBytes: 8, createdAt: '2026-08-25T10:00:00.000Z' }] : [],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
