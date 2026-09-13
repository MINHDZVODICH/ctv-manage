import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from '../api/client';
import type { AuthSessionResponse, ApiError } from '../api/types';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  mustChangePassword?: boolean;
};

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (form: FormData) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.apiGet<AuthSessionResponse>('/api/v1/auth/sessions/me');
      setUser(res.user?.id ? res.user : null);
    } catch (err) {
      if ((err as ApiError)?.status !== 401) {
        console.error('[AuthContext] Unexpected error refreshing auth session:', err);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setLoading(true);
        void refresh();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api.apiPost<AuthSessionResponse>('/api/v1/auth/sessions', {
      email,
      password,
    });
    setUser(res.user ?? null);
  };

  const register = async (form: FormData) => {
    await api.apiUpload('/api/v1/registration-requests', form, 'POST');
  };

  const logout = async () => {
    try {
      await api.apiDelete('/api/v1/auth/sessions/current');
    } catch (err) {
      console.error('[AuthContext] Unexpected error during session logout:', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}
