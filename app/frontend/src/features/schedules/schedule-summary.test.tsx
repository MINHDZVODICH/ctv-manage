// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SummaryScheduleScreen } from './SummaryScheduleScreen';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('SummaryScheduleScreen', () => {
  it('opens the shared shift roster and then the selected CTV profile', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/v1/schedule-summary?month=2026-08') return Promise.resolve(json({ data: { month: '2026-08', today: [], days: [{ date: '2026-08-24', slots: [{ shiftId: 'shift-1', period: 'MORNING', count: 2 }] }] } }));
      if (url === '/api/v1/shifts/shift-1') return Promise.resolve(json({ data: { shiftId: 'shift-1', workDate: '2026-08-24', period: 'MORNING', status: 'OPEN', assignment: null, coWorkers: [{ accountId: 'ctv-1', displayName: 'Nguyễn Văn A', roomCode: 'ROOM_1', workContent: 'Hỗ trợ', status: 'ACTIVE' }] } }));
      if (url === '/api/v1/accounts?') return Promise.resolve(json({ data: [], meta: { page: 1, pageSize: 5, total: 0 } }));
      if (url === '/api/v1/accounts/ctv-1') return Promise.resolve(json({ data: accountDetail() }));
      return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'not found' } }, 404));
    }));
    const user = userEvent.setup();
    render(<SummaryScheduleScreen initialMonth="2026-08" />);
    await user.click(await screen.findByRole('button', { name: /2 cộng tác viên/i }));
    await user.click(await screen.findByRole('button', { name: /nguyễn văn a/i }));
    expect(await screen.findByRole('heading', { name: /nguyễn văn a/i })).toBeVisible();
  });

  it('moves across year boundaries with calendar month arithmetic and requests the selected month', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(json({ data: { month: String(url).split('month=')[1], today: [], days: [] } })));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<SummaryScheduleScreen initialMonth="2026-01" />);
    await user.click(await screen.findByRole('button', { name: /tháng trước/i }));
    expect(await screen.findByText('Tháng 12, 2025')).toBeVisible();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/schedule-summary?month=2025-12')).toBe(true);
  });
});

function accountDetail() { return { id: 'ctv-1', displayName: 'Nguyễn Văn A', email: 'a@example.vn', phone: null, ctvCode: null, status: 'ACTIVE', version: 1, joinedAt: null, avatarFileId: null, role: 'CTV', dateOfBirth: null, gender: null, address: null, adminNotes: null, mustChangePassword: false, lastLoginAt: null, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', files: [] }; }
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
