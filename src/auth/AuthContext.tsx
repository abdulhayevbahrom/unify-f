import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Permission } from './permissions';
import { api } from '../services/api';
import { API_BASE_URL } from '../config/env';

export type AuthUser = {
  id: string;
  fullName: string;
  username: string;
  role: 'owner' | 'employee' | 'teacher';
  teacherId: string | null;
  permissions: Permission[];
  status: 'active' | 'inactive';
  lastLoginAt: string | null;
};

type AuthCredentials = {
  fullName?: string;
  username: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  setupRequired: boolean;
  login: (credentials: AuthCredentials) => Promise<void>;
  setup: (credentials: Required<AuthCredentials>) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
};

const TOKEN_KEY = 'sab_auth_token';
const AuthContext = createContext<AuthContextValue | null>(null);

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'So‘rovni bajarib bo‘lmadi');
  }

  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      try {
        const status = await readResponse(await fetch(`${API_BASE_URL}/auth/status`));
        setSetupRequired(status.setupRequired);

        const token = localStorage.getItem(TOKEN_KEY);

        if (!token || status.setupRequired) {
          return;
        }

        const currentUser = await readResponse(await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }));
        setUser(currentUser);
      } catch (_error) {
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function authenticate(path: 'login' | 'setup', credentials: AuthCredentials) {
    const data = await readResponse(await fetch(`${API_BASE_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    }));

    localStorage.setItem(TOKEN_KEY, data.token);
    dispatch(api.util.resetApiState());
    setUser(data.user);
    setSetupRequired(false);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    dispatch(api.util.resetApiState());
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    setupRequired,
    login: (credentials) => authenticate('login', credentials),
    setup: (credentials) => authenticate('setup', credentials),
    logout,
    hasPermission: (permission) => Boolean(user && (user.role === 'owner' || user.permissions.includes(permission))),
  }), [dispatch, loading, setupRequired, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  }

  return context;
}
