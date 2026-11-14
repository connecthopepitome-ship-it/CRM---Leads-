import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { scopeOf, hasPermission, type Resource, type RoleId } from '@ss/contracts';
import { api, auth, refresh } from './api';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: RoleId;
  roleLabel: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
}

interface AuthState {
  user: User | null;
  ready: boolean;
  mode: 'solo' | 'team';
  signIn(username: string, password: string): Promise<{ mfaToken?: string }>;
  verifyMfa(mfaToken: string, code: string): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  signOut(): Promise<void>;
  can(res: Resource, action?: 'read' | 'create' | 'update'): boolean;
  perm(p: string): boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'solo' | 'team'>('solo');

  const loadMe = useCallback(async () => {
    const me = await api<{ user: User; mode: 'solo' | 'team' }>('/me');
    setUser(me.user);
    setMode(me.mode);
  }, []);

  useEffect(() => {
    auth.onLogout(() => setUser(null));
    void (async () => {
      try {
        if (await refresh()) await loadMe();
      } catch {
        /* signed out */
      } finally {
        setReady(true);
      }
    })();
  }, [loadMe]);

  const value = useMemo<AuthState>(() => ({
    user, ready, mode,
    async signIn(username, password) {
      const r = await api<{ accessToken?: string; mfaRequired?: boolean; mfaToken?: string }>('/auth/login', { method: 'POST', body: { username, password } });
      if (r.mfaRequired) return { mfaToken: r.mfaToken };
      auth.set(r.accessToken ?? null);
      await loadMe();
      return {};
    },
    async verifyMfa(mfaToken, code) {
      const r = await api<{ accessToken: string }>('/auth/2fa/verify', { method: 'POST', body: { mfaToken, code } });
      auth.set(r.accessToken);
      await loadMe();
    },
    async changePassword(currentPassword, newPassword) {
      const r = await api<{ accessToken: string }>('/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
      auth.set(r.accessToken);
      await loadMe();
    },
    async signOut() {
      await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
      auth.set(null);
      setUser(null);
    },
    can(res, action = 'read') {
      return !!user && scopeOf(user.role, res, action) !== 'none';
    },
    perm(p) {
      return !!user && hasPermission(user.role, p);
    },
  }), [user, ready, mode, loadMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
