'use client';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

type Opts = Omit<RequestInit, 'body'> & { json?: unknown; form?: FormData };

/** fetch wrapper: same-origin cookies, JSON in/out, one silent refresh on 401, typed errors. */
export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { json, form, headers, ...rest } = opts;
  const send = () =>
    fetch(path, {
      credentials: 'same-origin',
      ...rest,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
    });

  let res = await send();
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
    if (r.ok) res = await send();
    else if (typeof window !== 'undefined') window.location.assign('/login');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (data as { error?: { message?: string; code?: string; fields?: { path: string; message: string }[] } }).error;
    throw new ApiError(res.status, e?.message ?? 'Request failed', e?.code, e?.fields);
  }
  return data as T;
}

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '';
