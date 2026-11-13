import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, refreshAccessToken, setAccessToken } from './api';

export interface AuthScope {
  unrestricted: boolean;
  companyIds: string[];
  branchIds: string[];
  orgUnitIds: string[];
  employeeIds: string[];
  ownEmployeeId: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  roles: { id: string; code: string; name: string }[];
  permissions: string[];
  scope: AuthScope;
  employee: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    status: string;
    orgUnit?: { id: string; name: string } | null;
    position?: { id: string; title: string } | null;
    company?: { id: string; name: string } | null;
  } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  hasRole: (code: string) => boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasRole: () => false,
  login: async () => {},
  logout: async () => {},
  reload: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const me = await api.get('/auth/me');
    setUser(me?.data?.data ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // تازه‌سازی توکن (توکن refresh سمت سرور می‌چرخد؛ استفادهٔ هم‌زمان باعث خروج اشتباه می‌شد)
        const token = await refreshAccessToken();
        if (!active) return;
        if (token) {
          const me = await api.get('/auth/me');
          if (active) setUser(me?.data?.data ?? null);
        } else {
          setUser(null);
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const hasPermission = useCallback(
    (code: string) => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return user.permissions?.includes(code) ?? false;
    },
    [user],
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => codes.some((c) => hasPermission(c)),
    [hasPermission],
  );

  const hasRole = useCallback(
    (code: string) => !!user?.roles?.some((r) => r.code === code),
    [user],
  );

  const login = useCallback(async (username: string, password: string, remember = true) => {
    const r = await api.post('/auth/login', { username, password, rememberMe: remember });
    setAccessToken(r?.data?.data?.accessToken ?? null);
    await loadMe();
  }, [loadMe]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, hasPermission, hasAnyPermission, hasRole, login, logout, reload: loadMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
