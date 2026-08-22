'use client';
/**
 * ============================================================================
 * 🔒 AUTH CONTEXT — DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * The single source of truth for "who is signed in" across the whole app.
 *
 *   const { user, isLoading, login, logout, isRole } = useAuth();
 *   if (isRole(ROLES.HOST)) { ... }
 * ============================================================================
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { tokenStore } from '@/lib/api';
import { ROLES } from '@/lib/constants';

const AuthContext = createContext(null);

/** Where each role lands after signing in. */
export const HOME_BY_ROLE = {
  [ROLES.DRIVER]: '/search',                    // [TDN] geo-search
  [ROLES.HOST]: '/host/spaces',                 // [SMR] provisioning
  [ROLES.ADMIN]: '/admin/host-verifications',   // [SMR] review queue
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Restore the session on first paint.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.access) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await api.get('/auth/me');
        if (!cancelled) setUser(data.user);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback((data) => {
    tokenStore.set(data);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (email, password) => persist(await api.post('/auth/login', { email, password })),
    [persist]
  );

  const registerDriver = useCallback(
    async (payload) => persist(await api.post('/auth/register/driver', payload)),
    [persist]
  );

  const registerHost = useCallback(
    async (payload) => persist(await api.post('/auth/register/host', payload)),
    [persist]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* signing out locally is what matters */
    }
    tokenStore.clear();
    setUser(null);
    router.push('/login');
  }, [router]);

  /** Refresh req.user after a profile edit. */
  const refreshUser = useCallback(async () => {
    const data = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  const isRole = useCallback((...roles) => Boolean(user && roles.includes(user.role)), [user]);

  const value = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    registerDriver,
    registerHost,
    refreshUser,
    setUser,
    isRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
