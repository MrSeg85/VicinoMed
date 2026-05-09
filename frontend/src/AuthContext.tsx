import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import { api, setToken, getToken } from './api';

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  role: 'patient' | 'doctor';
  phone?: string | null;
  auth_provider: 'email' | 'google';
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string, role: 'patient' | 'doctor', phone?: string) => Promise<User>;
  loginGoogle: () => Promise<void>;
  processSessionId: (sessionId: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

/** Route iniziale per un utente in base al suo ruolo. */
export function routeForUser(user: User | null): string {
  if (!user) return '/auth/login';
  if (user.role === 'doctor') return '/doctor-dashboard';
  return '/(tabs)/home';
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const r = await api.get('/auth/me');
      setUser(r.data);
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Web: parse hash for session_id (Emergent Google Auth callback)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      const m = hash.match(/session_id=([^&]+)/);
      if (m) {
        const sid = m[1];
        // Clean URL
        try { window.history.replaceState({}, document.title, window.location.pathname + window.location.search); } catch {}
        processSessionId(sid).finally(() => refresh());
        return;
      }
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api.post('/auth/login', { email, password });
    await setToken(r.data.session_token);
    setUser(r.data.user);
    return r.data.user as User;
  };

  const register = async (email: string, password: string, name: string, role: 'patient' | 'doctor', phone?: string) => {
    const r = await api.post('/auth/register', { email, password, name, role, phone });
    await setToken(r.data.session_token);
    setUser(r.data.user);
    return r.data.user as User;
  };

  const processSessionId = async (sessionId: string) => {
    const r = await api.post('/auth/google/session', { session_id: sessionId });
    await setToken(r.data.session_token);
    setUser(r.data.user);
    return r.data.user as User;
  };

  const loginGoogle = async () => {
    const redirect = Platform.OS === 'web'
      ? `${window.location.origin}/`
      : Linking.createURL('/');
    const url = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
    if (Platform.OS === 'web') {
      window.location.href = url;
      // After redirect, app comes back on `/` (index.tsx) which handles role-based redirect via useEffect.
    } else {
      const WebBrowser = await import('expo-web-browser');
      const result = await WebBrowser.openAuthSessionAsync(url, redirect);
      if (result.type === 'success' && result.url) {
        const m = result.url.match(/session_id=([^&]+)/);
        if (m) {
          await processSessionId(m[1]);
        }
      }
    }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    await setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, loginGoogle, processSessionId, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
