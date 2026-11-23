/**
 * API client for the deployed backend.
 *   EXPO_PUBLIC_API_URL → local: http://<your-LAN-IP>:3000   |   prod: https://<project>.vercel.app
 * The mobile app uses the SAME endpoints, validation and RBAC as the web app. It identifies itself with
 * `x-client: mobile` so the server returns tokens in JSON (kept in the OS keychain via SecureStore)
 * instead of httpOnly cookies, and authenticates with `Authorization: Bearer`.
 */
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const KEY = 'internlink.session';

type Tokens = { accessToken: string; refreshToken: string };
let tokens: Tokens | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export async function loadTokens() {
  const raw = await SecureStore.getItemAsync(KEY);
  tokens = raw ? (JSON.parse(raw) as Tokens) : null;
  return tokens;
}
export async function saveTokens(t: Tokens) { tokens = t; await SecureStore.setItemAsync(KEY, JSON.stringify(t)); }
export async function clearTokens() { tokens = null; await SecureStore.deleteItemAsync(KEY); }
export const getRefreshToken = () => tokens?.refreshToken;

async function refresh(): Promise<boolean> {
  if (!tokens) return false;
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client': 'mobile' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) { await clearTokens(); return false; }
  await saveTokens(await res.json());
  return true;
}

export async function api<T>(path: string, opts: { method?: string; json?: unknown } = {}): Promise<T> {
  const send = () =>
    fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? (opts.json ? 'POST' : 'GET'),
      headers: {
        'x-client': 'mobile',
        ...(opts.json ? { 'Content-Type': 'application/json' } : {}),
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      },
      body: opts.json ? JSON.stringify(opts.json) : undefined,
    });

  let res = await send();
  if (res.status === 401 && !path.startsWith('/api/auth/') && (await refresh())) res = await send();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Request failed', data?.error?.code);
  return data as T;
}
