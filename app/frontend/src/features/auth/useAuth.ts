import {
  createContext,
  createElement,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiClient } from '../../shared/api/client';
import type { AuthUser, SessionData } from '../../shared/api/contracts';
import { ApiClientError } from '../../shared/api/errors';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiClient.get<SessionData>('/auth/sessions/current')
      .then((session) => {
        if (active) setUser(session.user);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (!(reason instanceof ApiClientError) || reason.status !== 401) {
          setError(messageFor(reason));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const session = await apiClient.post<SessionData>('/auth/sessions', { email, password });
      setUser(session.user);
    } catch (reason) {
      setError(messageFor(reason));
      throw reason;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.delete('/auth/sessions/current');
      apiClient.clearSessionCache();
      setUser(null);
    } catch (reason) {
      setError(messageFor(reason));
      throw reason;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isSubmitting,
    error,
    login,
    logout,
  }), [user, isLoading, isSubmitting, error, login, logout]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}

function messageFor(reason: unknown): string {
  if (reason instanceof ApiClientError) {
    if (reason.code === 'INVALID_CREDENTIALS') return 'Email hoặc mật khẩu không đúng.';
    if (reason.code === 'ACCOUNT_DISABLED') return 'Tài khoản đã bị vô hiệu hóa.';
    return reason.message;
  }
  return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
}
