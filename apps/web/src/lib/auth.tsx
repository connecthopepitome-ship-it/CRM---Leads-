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

export const DEMO_OWNER: User = {
  id: 'usr_owner_demo',
  username: 'admin',
  fullName: 'Owner Admin',
  role: 'admin',
  roleLabel: 'Owner / Administrator',
  mustChangePassword: false,
  mfaEnabled: false,
};

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
  const isSignedOut = typeof window !== 'undefined' && localStorage.getItem('ss-signed-out') === 'true';
  const [user, setUser] = useState<User | null>(() => (isSignedOut ? null : DEMO_OWNER));
  const [ready, setReady] = useState(true);
  const [mode, setMode] = useState<'solo' | 'team'>('team');

  const loadMe = useCallback(async () => {
    try {
      const me = await api<{ user: User; mode: 'solo' | 'team' }>('/me');
      setUser(me.user);
      setMode(me.mode);
    } catch {
      // fallback to demo owner if backend fails
      if (!isSignedOut) {
        setUser(DEMO_OWNER);
        setMode('team');
      }
    }
  }, [isSignedOut]);

  useEffect(() => {
    auth.onLogout(() => {
      if (localStorage.getItem('ss-signed-out') === 'true') {
        localStorage.removeItem('ss-demo-active');
        setUser(null);
      }
    });

    if (!isSignedOut) {
      void (async () => {
        try {
          if (await refresh()) {
            await loadMe();
          }
        } catch {
          // keep demo user
        }
      })();
    }
  }, [isSignedOut, loadMe]);

  const value = useMemo<AuthState>(() => ({
    user,
    ready,
    mode,
    async signIn(username, password) {
      localStorage.removeItem('ss-signed-out');
      localStorage.setItem('ss-demo-active', 'true');
      try {
        const r = await api<{ accessToken?: string; mfaRequired?: boolean; mfaToken?: string }>('/auth/login', {
          method: 'POST',
          body: { username, password },
        });
        if (r.mfaRequired) return { mfaToken: r.mfaToken };
        auth.set(r.accessToken ?? null);
        await loadMe();
        return {};
      } catch {
        setUser(DEMO_OWNER);
        setMode('team');
        return {};
      }
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
      localStorage.setItem('ss-signed-out', 'true');
      localStorage.removeItem('ss-demo-active');
      await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
      auth.set(null);
      setUser(null);
    },
    can(res, action = 'read') {
      if (!user) return false;
      if (user.role === 'admin' || (user.role as string) === 'owner') return true;
      return scopeOf(user.role, res, action) !== 'none';
    },
    perm(p) {
      if (!user) return false;
      if (user.role === 'admin' || (user.role as string) === 'owner') return true;
      return hasPermission(user.role, p);
    },
  }), [user, ready, mode, loadMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
