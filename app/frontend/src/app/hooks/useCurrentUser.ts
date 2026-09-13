import { useState, useCallback, useEffect, useRef } from 'react';
import type { UserAccount } from '../../shared/types';
import { useAuth } from '../../shared/auth/AuthContext';
import { apiGet } from '../../shared/api';
import { isAbortError } from '../../shared/api/errors';
import { mapRole } from '../../shared/mappers';
import { accountDtoToDomain } from '../../features/accounts';
import type { CurrentUserResponse } from '../../features/accounts';

export interface UseCurrentUserResult {
  user: UserAccount | null;
  loading: boolean;
  refreshUser: () => Promise<UserAccount | null>;
  clearUser: () => void;
}

export function useCurrentUser(): UseCurrentUserResult {
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const currentUserRequestController = useRef<AbortController | null>(null);
  const currentUserRequestSequence = useRef(0);

  const clearUser = useCallback(() => {
    currentUserRequestController.current?.abort();
    currentUserRequestController.current = null;
    currentUserRequestSequence.current += 1;
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<UserAccount | null> => {
    currentUserRequestController.current?.abort();
    const controller = new AbortController();
    const sequence = ++currentUserRequestSequence.current;
    currentUserRequestController.current = controller;

    if (!authUser) {
      if (sequence === currentUserRequestSequence.current) {
        setUser(null);
      }
      return null;
    }

    setLoading(true);
    try {
      const res = await apiGet<CurrentUserResponse>('/api/v1/users/me', {
        signal: controller.signal,
      });
      if (sequence !== currentUserRequestSequence.current) return null;

      const raw = res?.user;
      if (raw?.id) {
        const mapped = accountDtoToDomain(raw, 0);
        setUser(mapped);
        return mapped;
      }
    } catch (err: unknown) {
      if (isAbortError(err) || sequence !== currentUserRequestSequence.current) return null;
      console.error('[useCurrentUser] Failed to load current user profile:', err);
    } finally {
      if (sequence === currentUserRequestSequence.current) {
        setLoading(false);
      }
    }

    if (sequence !== currentUserRequestSequence.current) return null;

    if (authUser) {
      const fallback: UserAccount = {
        id: authUser.id,
        stt: 1,
        name: authUser.displayName,
        email: authUser.email,
        phone: '',
        role: mapRole(authUser.role),
        status: 'Kích hoạt',
        registerDate: '',
      };
      setUser(fallback);
      return fallback;
    }

    return null;
  }, [authUser]);

  useEffect(() => {
    if (!authLoading) {
      void refreshUser();
    }
  }, [authLoading, refreshUser]);

  useEffect(() => {
    return () => {
      currentUserRequestController.current?.abort();
      currentUserRequestSequence.current += 1;
    };
  }, []);

  return {
    user,
    loading: loading || authLoading,
    refreshUser,
    clearUser,
  };
}
