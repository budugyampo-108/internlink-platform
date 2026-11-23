import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, readJson, route, toErrorResponse, clientIp } from '@/lib/http';
import { REFRESH_COOKIE, clearAuthCookies, rotateRefreshToken, setAuthCookies } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { isMobileClient } from '@/lib/session-response';
import { ok } from '@/lib/http';

/** Mobile + fetch clients: POST. Mobile sends { refreshToken }; web relies on the httpOnly cookie. */
export const POST = route(async (req) => {
  await rateLimit('refresh', clientIp(req), 60, 600);
  let raw = req.cookies.get(REFRESH_COOKIE)?.value;
  if (isMobileClient(req)) {
    raw = (await readJson(req, z.object({ refreshToken: z.string().min(20).max(200) }).strict())).refreshToken;
  }
  if (!raw) throw new HttpError(401, 'Please sign in', 'UNAUTHENTICATED');

  const tokens = await rotateRefreshToken(raw);
  if (isMobileClient(req)) return ok(tokens);
  const res = ok({ refreshed: true });
  setAuthCookies(res, tokens);
  return res;
});

/** Browser navigation flow used by middleware: rotate silently, then bounce back to the page. */
export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  // Only allow same-site relative paths (prevents open-redirect).
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  try {
    if (!raw) throw new HttpError(401, 'no session');
    const tokens = await rotateRefreshToken(raw);
    const res = NextResponse.redirect(new URL(safeNext, req.url));
    setAuthCookies(res, tokens);
    return res;
  } catch (e) {
    if (!(e instanceof HttpError)) return toErrorResponse(e);
    const res = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(safeNext)}`, req.url));
    clearAuthCookies(res);
    return res;
  }
}
