// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../shared/api/client';
import { CTVScheduleWorkspace } from './CTVScheduleWorkspace';

afterEach(() => {
  cleanup();
  apiClient.clearSessionCache();
  vi.unstubAllGlobals();
});

describe('CTVScheduleWorkspace', () => {
  it('requires one of the four fixed rooms and at least one slot before saving', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/users/me/schedule-registration') return Promise.resolve(jsonResponse({ data: null }));
      if (url.startsWith('/api/v1/users/me/shifts?')) return Promise.resolve(jsonResponse({ data: [] }));
      return Promise.resolve(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<CTVScheduleWorkspace today="2026-08-24" />);

    await user.click(await screen.findByRole('button', { name: /đăng ký lịch làm việc/i }));
    await user.click(screen.getByRole('button', { name: /lưu lịch/i }));

    expect(await screen.findByText(/chọn buồng làm việc/i)).toBeVisible();
    expect(screen.getByText(/chọn ít nhất một ca/i)).toBeVisible();
    expect(screen.getByLabelText(/buồng làm việc/i)).toHaveTextContent(/Buồng 1/);
    expect(within(screen.getByLabelText(/buồng làm việc/i)).getAllByRole('option')).toHaveLength(5);
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(false);
  });

  it('reloads the registration after VERSION_CONFLICT instead of overwriting', async () => {
    let registrationLoads = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/v1/users/me/schedule-registration' && (!init?.method || init.method === 'GET')) {
        registrationLoads += 1;
        return Promise.resolve(jsonResponse({ data: registration(
          registrationLoads === 1 ? 1 : 2,
          registrationLoads === 1 ? {} : {
            roomCode: 'ROOM_3',
            workContent: 'Nội dung vừa được cập nhật',
            slots: [{ weekday: 5, period: 'AFTERNOON' }],
          },
        ) }));
      }
      if (url.startsWith('/api/v1/users/me/shifts?')) return Promise.resolve(jsonResponse({ data: [] }));
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf-schedule' } }));
      if (url === '/api/v1/users/me/schedule-registration' && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ error: { code: 'VERSION_CONFLICT', message: 'Conflict' } }, 409));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<CTVScheduleWorkspace today="2026-08-24" />);

    await user.click(await screen.findByRole('button', { name: /đăng ký lịch làm việc/i }));
    await user.click(screen.getByRole('button', { name: /lưu lịch/i }));

    expect(await screen.findByText(/dữ liệu đã được cập nhật/i)).toBeVisible();
    await waitFor(() => expect(registrationLoads).toBe(2));
    const put = fetchMock.mock.calls.find((call) => call[0] === '/api/v1/users/me/schedule-registration' && call[1]?.method === 'PUT');
    expect(JSON.parse(put?.[1]?.body as string).version).toBe(1);
    expect(screen.getByRole('dialog', { name: /đăng ký lịch làm việc/i })).toBeVisible();
    expect(screen.getByLabelText(/buồng làm việc/i)).toHaveValue('ROOM_3');
    expect(screen.getByLabelText(/nội dung công việc/i)).toHaveValue('Nội dung vừa được cập nhật');
    expect(screen.getByRole('button', { name: /thứ 6 ca chiều/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens live shift detail, shows co-workers, confirms one cancellation, and reloads the same view', async () => {
    let shiftLoads = 0;
    const futureShift = shift('assignment-1', 'shift-1', '2026-08-24', true);
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/v1/users/me/schedule-registration') return Promise.resolve(jsonResponse({ data: registration(1) }));
      if (url.startsWith('/api/v1/users/me/shifts?')) {
        shiftLoads += 1;
        return Promise.resolve(jsonResponse({ data: shiftLoads === 1 ? [futureShift] : [] }));
      }
      if (url === '/api/v1/shifts/shift-1') return Promise.resolve(jsonResponse({ data: detail(futureShift, true) }));
      if (url === '/api/v1/auth/csrf-token') return Promise.resolve(jsonResponse({ data: { csrfToken: 'csrf-cancel' } }));
      if (url === '/api/v1/users/me/shift-assignments/assignment-1' && init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse({ data: { scope: 'ONE', fromDate: '2026-08-24', affectedCount: 1 } }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<CTVScheduleWorkspace today="2026-08-24" />);

    await user.click(await screen.findByRole('button', { name: /ca sáng.*24\/08/i }));
    const dialog = await screen.findByRole('dialog', { name: /chi tiết ca làm việc/i });
    expect(dialog).toHaveTextContent('CTV Đồng Nghiệp');
    expect(dialog).toHaveTextContent('Buồng 2');
    await user.click(within(dialog).getByRole('button', { name: /chỉ hủy ca này/i }));
    expect(within(dialog).getByText(/bạn có chắc/i)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: /^xác nhận hủy$/i }));

    expect(await screen.findByText(/đã hủy 1 ca/i)).toBeVisible();
    await waitFor(() => expect(shiftLoads).toBe(2));
    expect(screen.queryByRole('dialog', { name: /chi tiết ca làm việc/i })).not.toBeInTheDocument();
  });

  it('renders a past shift as read-only and exposes history through the same API data', async () => {
    const pastShift = shift('assignment-past', 'shift-past', '2026-08-21', false);
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/users/me/schedule-registration') return Promise.resolve(jsonResponse({ data: registration(1) }));
      if (url.startsWith('/api/v1/users/me/shifts?')) return Promise.resolve(jsonResponse({ data: [pastShift] }));
      if (url === '/api/v1/shifts/shift-past') return Promise.resolve(jsonResponse({ data: detail(pastShift, false) }));
      return Promise.resolve(jsonResponse({}, 404));
    }));
    const user = userEvent.setup();
    render(<CTVScheduleWorkspace today="2026-08-24" initialDate="2026-08-21" />);

    await user.click(await screen.findByRole('tab', { name: /lịch sử làm việc/i }));
    const history = await screen.findByRole('table', { name: /lịch sử làm việc/i });
    expect(within(history).getByText('21/08/2026')).toBeVisible();
    await user.click(within(history).getByRole('button', { name: /ca sáng.*21\/08/i }));
    const dialog = await screen.findByRole('dialog', { name: /chi tiết ca làm việc/i });
    expect(dialog).toHaveTextContent(/ca đã qua.*không thể hủy/i);
    expect(within(dialog).queryByRole('button', { name: /hủy ca/i })).not.toBeInTheDocument();
  });

  it('moves the history view one calendar month at a time from a month-end date', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/users/me/schedule-registration') return Promise.resolve(jsonResponse({ data: registration(1) }));
      if (url.startsWith('/api/v1/users/me/shifts?')) return Promise.resolve(jsonResponse({ data: [] }));
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<CTVScheduleWorkspace today="2026-01-31" initialDate="2026-01-31" />);

    await user.click(await screen.findByRole('tab', { name: /lịch sử làm việc/i }));
    await user.click(screen.getByRole('button', { name: /xem tháng sau/i }));

    expect(await screen.findByText('Tháng 2, 2026')).toBeVisible();
    expect(fetchMock.mock.calls.some((call) => call[0] === '/api/v1/users/me/shifts?month=2026-02')).toBe(true);
  });
});

function registration(version: number, overrides: Record<string, unknown> = {}) {
  return {
    id: 'registration-1', startDate: '2026-08-24', endDate: '2026-09-30', timeZone: 'Asia/Bangkok',
    roomCode: 'ROOM_1', workContent: 'Hỗ trợ xử lý dữ liệu', version, status: 'ACTIVE',
    updatedAt: '2026-08-24T00:00:00.000Z', slots: [{ weekday: 1, period: 'MORNING' }], ...overrides,
  };
}

function shift(assignmentId: string, shiftId: string, workDate: string, canCancel: boolean) {
  return {
    assignmentId, shiftId, registrationId: 'registration-1', workDate, weekday: new Date(`${workDate}T00:00:00Z`).getUTCDay(),
    period: 'MORNING', roomCode: 'ROOM_1', workContent: 'Hỗ trợ xử lý dữ liệu', status: 'ACTIVE', canCancel,
  };
}

function detail(item: ReturnType<typeof shift>, canCancel: boolean) {
  return {
    shiftId: item.shiftId, workDate: item.workDate, weekday: item.weekday, period: item.period, status: 'OPEN',
    assignment: { assignmentId: item.assignmentId, registrationId: item.registrationId, roomCode: item.roomCode, workContent: item.workContent, status: 'ACTIVE' },
    canCancel, cancelScopes: canCancel ? ['ONE', 'SERIES'] : [],
    coWorkers: [{ accountId: 'coworker-1', displayName: 'CTV Đồng Nghiệp', roomCode: 'ROOM_2' }],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
