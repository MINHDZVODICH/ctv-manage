// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAccountsAdmin } from '../src/features/accounts/hooks/useAccountsAdmin';
import { useRegistrationRequests } from '../src/features/registration/hooks/useRegistrationRequests';
import { useScheduleDashboard } from '../src/features/schedule/hooks/useScheduleDashboard';
import { useCurrentUser } from '../src/app/hooks/useCurrentUser';
import { accountsApi } from '../src/features/accounts/api/accountsApi';
import { registrationApi } from '../src/features/registration/api/registrationApi';
import type { RegistrationListResponse } from '../src/features/registration/types/registration-request.dto';
import * as api from '../src/shared/api';
import type { AuthState } from '../src/shared/auth/AuthContext';

let mockAuthState: AuthState = {
  user: { id: 'usr-1', email: 'user@test.com', displayName: 'User One', role: 'ADMIN' },
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('../src/shared/auth/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

describe('Frontend Feature Hooks (React Testing Library & jsdom)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthState = {
      user: { id: 'usr-1', email: 'user@test.com', displayName: 'User One', role: 'ADMIN' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('useAccountsAdmin', () => {
    it('initializes default state and loads accounts', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          email: 'user1@test.com',
          displayName: 'User One',
          role: 'CTV',
          status: 'ACTIVE',
          version: 1,
        },
      ];

      vi.spyOn(accountsApi, 'listAccounts').mockResolvedValueOnce({
        data: mockAccounts,
        total: 1,
        page: 1,
        pageSize: 5,
      });

      const { result } = renderHook(() => useAccountsAdmin({ isAdmin: true }));
      expect(result.current.accounts).toEqual([]);
      expect(result.current.accountQuery.page).toBe(1);

      await act(async () => {
        await result.current.loadAccounts();
      });

      expect(accountsApi.listAccounts).toHaveBeenCalledWith(
        { page: 1, pageSize: 5, q: undefined },
        expect.any(Object),
      );
      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0].name).toBe('User One');
      expect(result.current.accountQuery.total).toBe(1);
    });

    it('handles status toggle, password reset, notes, and deletion', async () => {
      const mockAccount = {
        id: 'acc-1',
        email: 'user1@test.com',
        displayName: 'User One',
        role: 'CTV',
        status: 'ACTIVE',
        version: 2,
      };

      vi.spyOn(accountsApi, 'getAccount').mockResolvedValue({ data: mockAccount });
      vi.spyOn(accountsApi, 'changeStatus').mockResolvedValue({
        data: { ...mockAccount, status: 'DISABLED' },
      });
      vi.spyOn(accountsApi, 'deleteAccount').mockResolvedValue({ data: mockAccount });
      vi.spyOn(accountsApi, 'resetPassword').mockResolvedValue({ data: mockAccount });
      vi.spyOn(accountsApi, 'updateNotes').mockResolvedValue({ data: mockAccount });
      vi.spyOn(accountsApi, 'listAccounts').mockResolvedValue({
        data: [mockAccount],
        total: 1,
        page: 1,
        pageSize: 5,
      });
      const confirmSpy = vi.spyOn(window, 'confirm');

      const onToast = vi.fn();
      const { result } = renderHook(() => useAccountsAdmin({ isAdmin: true, onToast }));

      // Populate accounts state via loadAccounts
      await act(async () => {
        await result.current.loadAccounts();
      });
      expect(result.current.accounts).toHaveLength(1);

      await act(async () => {
        await result.current.toggleAccountStatus('acc-1');
      });
      // Should invoke changeStatus with exact union 'DISABLED'
      expect(accountsApi.changeStatus).toHaveBeenCalledWith('acc-1', 'DISABLED', 2);
      expect(onToast).toHaveBeenCalled();

      await act(async () => {
        await result.current.resetPassword('acc-1', 'NewPassword123!', true);
      });
      expect(accountsApi.resetPassword).toHaveBeenCalledWith('acc-1', 'NewPassword123!', true);

      await act(async () => {
        await result.current.saveAccountNotes('acc-1', 'Admin verified');
      });
      expect(accountsApi.updateNotes).toHaveBeenCalledWith('acc-1', 'Admin verified', 2);

      await act(async () => {
        await result.current.deleteAccount('acc-1');
      });
      expect(accountsApi.deleteAccount).toHaveBeenCalledWith('acc-1');
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('handles search input debouncing and pagination changes', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useAccountsAdmin({ isAdmin: true }));

      act(() => {
        result.current.setPage(3);
      });
      expect(result.current.accountQuery.page).toBe(3);

      act(() => {
        result.current.setAccountSearchInput('john');
      });
      // Before debounce fires
      expect(result.current.accountQuery.q).toBe('');

      // Advance debounce timer
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(result.current.accountQuery.q).toBe('john');
      expect(result.current.accountQuery.page).toBe(1);

      act(() => {
        result.current.resetFilters();
      });
      expect(result.current.accountQuery.page).toBe(1);
      expect(result.current.accountQuery.q).toBe('');
      vi.useRealTimers();
    });

    it('protects against stale / out-of-order listAccounts responses', async () => {
      let resolveFirst: (v: any) => void = () => {};
      let resolveSecond: (v: any) => void = () => {};

      const firstPromise = new Promise((res) => {
        resolveFirst = res;
      });
      const secondPromise = new Promise((res) => {
        resolveSecond = res;
      });

      vi.spyOn(accountsApi, 'listAccounts')
        .mockReturnValueOnce(firstPromise as any)
        .mockReturnValueOnce(secondPromise as any);

      const { result } = renderHook(() => useAccountsAdmin({ isAdmin: true }));

      // Trigger first request
      let p1: Promise<void>;
      act(() => {
        p1 = result.current.loadAccounts();
      });

      // Trigger second request before first finishes
      let p2: Promise<void>;
      act(() => {
        p2 = result.current.loadAccounts();
      });

      // Second resolves first with newer data
      await act(async () => {
        resolveSecond({
          data: [
            {
              id: 'acc-2',
              email: 'newer@test.com',
              displayName: 'Newer Account',
              role: 'CTV',
              status: 'ACTIVE',
              version: 1,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 5,
        });
        await p2;
      });

      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0].name).toBe('Newer Account');

      // First resolves later with older stale data
      await act(async () => {
        resolveFirst({
          data: [
            {
              id: 'acc-1',
              email: 'older@test.com',
              displayName: 'Older Account',
              role: 'CTV',
              status: 'ACTIVE',
              version: 1,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 5,
        });
        await p1;
      });

      // Stale data must NOT overwrite newer data
      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0].name).toBe('Newer Account');
    });

    it('protects against race conditions in account detail selection and closing', async () => {
      let resolveSlowDetail: (v: any) => void = () => {};
      const slowDetailPromise = new Promise((res) => {
        resolveSlowDetail = res;
      });

      vi.spyOn(accountsApi, 'getAccount').mockReturnValueOnce(slowDetailPromise as any);

      const { result } = renderHook(() => useAccountsAdmin({ isAdmin: true }));

      // Start opening slow detail for Account 1
      act(() => {
        void result.current.openAccountDetailById('acc-1');
      });

      // User closes modal immediately
      act(() => {
        result.current.closeAccountDetail();
      });
      expect(result.current.selectedAccountDetail).toBeNull();

      // Late response from Account 1 arrives
      await act(async () => {
        resolveSlowDetail({
          data: {
            id: 'acc-1',
            email: 'a1@test.com',
            displayName: 'Account One',
            role: 'CTV',
            status: 'ACTIVE',
            version: 1,
          },
        });
      });

      // Stale late response must NOT reopen the closed modal
      expect(result.current.selectedAccountDetail).toBeNull();
    });

    it('discards in-flight response when clearAccounts is called', async () => {
      let resolveList: (v: any) => void = () => {};
      const listPromise = new Promise((res) => {
        resolveList = res;
      });

      vi.spyOn(accountsApi, 'listAccounts').mockReturnValueOnce(listPromise as any);

      const { result } = renderHook(() => useAccountsAdmin({ isAdmin: true }));

      act(() => {
        void result.current.loadAccounts();
      });

      // User logs out / calls clearAccounts
      act(() => {
        result.current.clearAccounts();
      });

      // Late response arrives
      await act(async () => {
        resolveList({
          data: [
            {
              id: 'acc-1',
              email: 'a1@test.com',
              displayName: 'Account One',
              role: 'CTV',
              status: 'ACTIVE',
              version: 1,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 5,
        });
      });

      expect(result.current.accounts).toEqual([]);
      expect(result.current.selectedAccountDetail).toBeNull();
    });

    it('aborts active fetch on unmount', async () => {
      let capturedSignal: AbortSignal | undefined;
      vi.spyOn(accountsApi, 'listAccounts').mockImplementation((_filters, opts: any) => {
        capturedSignal = opts?.signal;
        return new Promise(() => {}); // never resolves
      });

      const { result, unmount } = renderHook(() => useAccountsAdmin({ isAdmin: true }));

      act(() => {
        void result.current.loadAccounts();
      });

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(false);

      unmount();

      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  describe('useRegistrationRequests', () => {
    it('loads requests and performs approve and reject actions', async () => {
      const mockRequest = {
        id: 'req-1',
        email: 'reg@test.com',
        displayName: 'Applicant',
        status: 'PENDING',
      };

      vi.spyOn(registrationApi, 'listRequests').mockResolvedValue({
        items: [mockRequest],
        total: 1,
        page: 1,
        pageSize: 5,
      });
      vi.spyOn(registrationApi, 'decideRequest').mockResolvedValue({
        request: { ...mockRequest, status: 'APPROVED' },
      });

      const onToast = vi.fn();
      const { result } = renderHook(() => useRegistrationRequests({ isAdmin: true, onToast }));

      await act(async () => {
        await result.current.loadRequests();
      });

      expect(registrationApi.listRequests).toHaveBeenCalled();
      expect(result.current.requests).toHaveLength(1);
      expect(result.current.requests[0].name).toBe('Applicant');

      await act(async () => {
        await result.current.approveRequest('req-1');
      });
      expect(registrationApi.decideRequest).toHaveBeenCalledWith('req-1', 'APPROVED');
      expect(onToast).toHaveBeenCalled();

      await act(async () => {
        await result.current.rejectRequest('req-1');
      });
      expect(registrationApi.decideRequest).toHaveBeenCalledWith('req-1', 'REJECTED');
    });

    it('protects against stale requests resolution and handles clearRequests', async () => {
      let resolveSlow: (v: RegistrationListResponse) => void = () => {};
      const slowPromise = new Promise<RegistrationListResponse>((res) => {
        resolveSlow = res;
      });

      vi.spyOn(registrationApi, 'listRequests').mockReturnValueOnce(slowPromise);

      const { result } = renderHook(() => useRegistrationRequests({ isAdmin: true }));

      act(() => {
        void result.current.loadRequests();
      });

      act(() => {
        result.current.clearRequests();
      });

      await act(async () => {
        resolveSlow({
          items: [
            {
              id: 'req-9',
              email: 'late@test.com',
              displayName: 'Late Applicant',
              status: 'PENDING',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 5,
        });
      });

      // Should not repopulate after clearRequests
      expect(result.current.requests).toEqual([]);
    });

    it('aborts active fetch on unmount', async () => {
      let capturedSignal: AbortSignal | null | undefined;
      vi.spyOn(registrationApi, 'listRequests').mockImplementation((_filters, opts) => {
        capturedSignal = opts?.signal;
        return new Promise(() => {});
      });

      const { result, unmount } = renderHook(() => useRegistrationRequests({ isAdmin: true }));

      act(() => {
        void result.current.loadRequests();
      });

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(false);

      unmount();

      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  describe('useCurrentUser', () => {
    it('loads current user profile from /api/v1/users/me', async () => {
      vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        user: {
          id: 'usr-1',
          email: 'user@test.com',
          displayName: 'User One',
          role: 'ADMIN',
          status: 'ACTIVE',
          version: 1,
        },
      });

      const { result } = renderHook(() => useCurrentUser());

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      expect(result.current.user?.name).toBe('User One');
      expect(result.current.user?.role).toBe('Admin');
    });

    it('falls back to auth user profile when /api/v1/users/me fails', async () => {
      vi.spyOn(api, 'apiGet').mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCurrentUser());

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      expect(result.current.user?.id).toBe('usr-1');
      expect(result.current.user?.email).toBe('user@test.com');
      expect(result.current.user?.name).toBe('User One');
    });

    it('protects against stale responses and clears user properly', async () => {
      let resolveSlowMe: (v: any) => void = () => {};
      const slowMePromise = new Promise((res) => {
        resolveSlowMe = res;
      });

      vi.spyOn(api, 'apiGet').mockReturnValueOnce(slowMePromise as any);

      const { result } = renderHook(() => useCurrentUser());

      act(() => {
        result.current.clearUser();
      });
      expect(result.current.user).toBeNull();

      // Resolve slow response after clearUser
      await act(async () => {
        resolveSlowMe({
          user: {
            id: 'usr-stale',
            email: 'stale@test.com',
            displayName: 'Stale User',
            role: 'CTV',
            status: 'ACTIVE',
            version: 1,
          },
        });
      });

      // Must remain null, stale response rejected
      expect(result.current.user).toBeNull();
    });
  });

  describe('useScheduleDashboard', () => {
    it('loads schedule registration for CTV user', async () => {
      vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        data: {
          roomCode: 'ROOM_1',
          shifts: [{ weekday: 1, period: 'MORNING' }],
        },
      });

      const { result } = renderHook(() =>
        useScheduleDashboard({
          authUser: { id: 'ctv-1', email: 'c@test.com', displayName: 'CTV User', role: 'CTV' },
          isAdmin: false,
          currentUser: null,
        }),
      );

      await act(async () => {
        await result.current.loadShifts();
      });

      expect(api.apiGet).toHaveBeenCalledWith('/api/v1/users/me/schedule-registration');
      expect(result.current.shifts.length).toBeGreaterThan(0);
    });

    it('loads weekly summary for Admin user', async () => {
      vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        data: {
          cells: [{ weekday: 1, period: 'MORNING', count: 1, shiftAssignments: [] }],
        },
      });

      const { result } = renderHook(() =>
        useScheduleDashboard({
          authUser: {
            id: 'admin-1',
            email: 'a@test.com',
            displayName: 'Admin User',
            role: 'ADMIN',
          },
          isAdmin: true,
          currentUser: null,
        }),
      );

      await act(async () => {
        await result.current.loadShifts();
      });

      expect(api.apiGet).toHaveBeenCalledWith('/api/v1/schedule/weekly-summary');
      expect(result.current.shifts.length).toBeGreaterThan(0);
    });
  });
});
