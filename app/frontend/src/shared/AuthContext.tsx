import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../shared/api';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  mustChangePassword?: boolean;
};

type AuthState = {
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

  const refresh = async () => {
    try {
      const res: any = await api.apiGet('/api/v1/auth/sessions/me');
      // backend returns { user: {...} }  ; also support { data: ...}
      const u = res.user ?? res.data ?? res;
      setUser(u && u.id ? u : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (email: string, password: string) => {
    const res: any = await api.apiPost('/api/v1/auth/sessions', { email, password });
    const u = res.user ?? res.data ?? res;
    setUser(u);
  };

  const register = async (form: FormData) => {
    await api.apiUpload('/api/v1/registration-requests', form, 'POST');
  };

  const logout = async () => {
    try {
      await api.apiDelete('/api/v1/auth/sessions/current');
    } finally {
      setUser(null);
    }
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}
