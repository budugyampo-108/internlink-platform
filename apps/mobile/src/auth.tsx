import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearTokens, getRefreshToken, loadTokens, saveTokens } from './api';

export type User = { id: string; role: 'STUDENT' | 'COMPANY'; fullName: string; email: string };
type Ctx = { user: User | null; ready: boolean; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void> };

const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (await loadTokens()) setUser((await api<{ user: User }>('/api/auth/me')).user);
      } catch { await clearTokens(); }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/login', { json: { email, password } });
    await saveTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    setUser(r.user);
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken();
    await api('/api/auth/logout', { json: { refreshToken } }).catch(() => undefined);
    await clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
