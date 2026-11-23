import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, verifyAccessToken } from '@/lib/jwt';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  /* ── CSRF defence for cookie-authenticated API mutations ──
     Bearer-token clients (mobile) are not CSRF-able, so only check cookie traffic. */
  if (pathname.startsWith('/api/') && !SAFE_METHODS.has(req.method) && !req.headers.get('authorization')) {
    const origin = req.headers.get('origin');
    const site = req.headers.get('sec-fetch-site');
    const crossOrigin =
      (origin && new URL(origin).host !== req.headers.get('host')) || site === 'cross-site';
    if (crossOrigin) {
      return NextResponse.json({ error: { code: 'CSRF', message: 'Cross-origin request blocked' } }, { status: 403 });
    }
  }

  /* ── Page guards (defence in depth; API handlers re-check on every call) ── */
  if (pathname.startsWith('/student') || pathname.startsWith('/company')) {
    const session = await verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value);
    if (!session) {
      // Try a silent refresh (the refresh cookie is only sent to /api/auth/*); it falls back to /login.
      const url = new URL('/api/auth/refresh', req.url);
      url.searchParams.set('next', pathname + search);
      return NextResponse.redirect(url);
    }
    const home = session.role === 'STUDENT' ? '/student' : '/company';
    if (!pathname.startsWith(home)) return NextResponse.redirect(new URL(home, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/student/:path*', '/company/:path*', '/api/:path*'] };
