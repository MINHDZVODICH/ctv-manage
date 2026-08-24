// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../shared/api/client';
import { RegistrationScreen } from './RegistrationScreen';
import { RequestsScreen } from './RequestsScreen';

afterEach(() => {
  cleanup();
  apiClient.clearSessionCache();
  vi.unstubAllGlobals();
});

describe('RegistrationScreen', () => {
  it('does not send confirmPassword and clears sensitive fields after submission', async () => {
    let capturedProfile!: Record<string, unknown>;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      capturedProfile = JSON.parse(String(form.get('profile'))) as Record<string, unknown>;
      return Promise.resolve(jsonResponse({
        data: { id: 'req_1', status: 'PENDING', submittedAt: '2026-08-25T10:00:00.000Z' },
      }, 201));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<RegistrationScreen onBackToLogin={() => undefined} />);
    await user.type(screen.getByLabelText(/họ và tên/i), 'Nguyễn Văn A');
    await user.type(screen.getByLabelText(/^email$/i), 'ctv@example.vn');
    await user.type(screen.getByLabelText(/số điện thoại/i), '0900000000');
    await user.type(screen.getByLabelText(/^mật khẩu$/i), 'Secret123');
    await user.type(screen.getByLabelText(/nhập lại mật khẩu/i), 'Secret123');
    await user.click(screen.getByRole('button', { name: /gửi yêu cầu đăng ký/i }));

    expect(await screen.findByText(/đã gửi hồ sơ/i)).toBeVisible();
    expect(capturedProfile).not.toHaveProperty('confirmPassword');
    expect(capturedProfile.password).toBe('Secret123');
    expect(screen.getByLabelText(/^mật khẩu$/i)).toHaveValue('');
    expect(screen.getByLabelText(/nhập lại mật khẩu/i)).toHaveValue('');
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('/api/v1/registration-requests');
    expect(call[1].headers).toEqual(expect.objectContaining({ 'Idempotency-Key': expect.any(String) }));
    expect(call[1].headers).not.toHaveProperty('Content-Type');
    expect(call[1].headers).not.toHaveProperty('X-CSRF-Token');
  });

  it('keeps registration client-side when password confirmation does not match', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<RegistrationScreen onBackToLogin={() => undefined} />);
    await user.type(screen.getByLabelText(/họ và tên/i), 'Nguyễn Văn A');
    await user.type(screen.getByLabelText(/^email$/i), 'ctv@example.vn');
    await user.type(screen.getByLabelText(/số điện thoại/i), '0900000000');
    await user.type(screen.getByLabelText(/^mật khẩu$/i), 'Secret123');
    await user.type(screen.getByLabelText(/nhập lại mật khẩu/i), 'Different123');
    await user.click(screen.getByRole('button', { name: /gửi yêu cầu đăng ký/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mật khẩu phải trùng khớp/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('RequestsScreen', () => {
  it('reloads the pending page after an Admin approves a request', async () => {
    const pendingItem = {
      id: 'req_1',
      displayName: 'Nguyễn Văn A',
      email: 'ctv@example.vn',
      phone: '0900000000',
      dateOfBirth: '2000-01-01',
      status: 'PENDING',
      submittedAt: '2026-08-25T10:00:00.000Z',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { items: [pendingItem], pagination: { page: 1, pageSize: 20, total: 1 } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { csrfToken: 'csrf-123' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'req_1', status: 'APPROVED', reviewedAt: '2026-08-25T10:05:00.000Z' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [], pagination: { page: 1, pageSize: 20, total: 0 } } }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<RequestsScreen />);
    await user.click(await screen.findByRole('button', { name: /phê duyệt hồ sơ nguyễn văn a/i }));

    expect(await screen.findByText(/đã duyệt hồ sơ/i)).toBeVisible();
    expect(await screen.findByText(/không có hồ sơ chờ duyệt/i)).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[0][0]).toContain('status=PENDING');
    expect(fetchMock.mock.calls[3][0]).toContain('status=PENDING');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: 'PATCH',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-123' }),
    });
  });

  it('loads request detail without exposing storage keys', async () => {
    const pendingItem = {
      id: 'req_2', displayName: 'Trần Thị B', email: 'b@example.vn', phone: null,
      dateOfBirth: null, status: 'PENDING', submittedAt: '2026-08-25T10:00:00.000Z',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { items: [pendingItem], pagination: { page: 1, pageSize: 20, total: 1 } } }))
      .mockResolvedValueOnce(jsonResponse({ data: {
        ...pendingItem,
        gender: 'FEMALE',
        address: 'Hà Nội',
        reviewedAt: null,
        rejectionReason: null,
        files: [{ id: 'file_1', category: 'CV', originalName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 2048 }],
      } }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<RequestsScreen />);
    await user.click(await screen.findByRole('button', { name: /xem hồ sơ trần thị b/i }));

    const dialog = await screen.findByRole('dialog', { name: /chi tiết hồ sơ đăng ký ctv/i });
    expect(dialog).toHaveTextContent('cv.pdf');
    expect(dialog).not.toHaveTextContent(/storageKey/i);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/registration-requests/req_2');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
