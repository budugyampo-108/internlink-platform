import type { NextRequest } from 'next/server';
import { ok } from './http';
import { setAuthCookies, type Tokens } from './auth';

export const isMobileClient = (req: NextRequest) => req.headers.get('x-client') === 'mobile';

/**
 * Web  → tokens go ONLY into httpOnly cookies (JS can never read them → XSS-resistant).
 * Mobile → tokens are returned in the body (stored in the OS keychain via expo-secure-store).
 */
export function sessionResponse(
  req: NextRequest,
  user: { id: string; role: string; fullName: string; email: string },
  tokens: Tokens,
  status = 200,
) {
  if (isMobileClient(req)) return ok({ user, ...tokens }, status);
  const res = ok({ user }, status);
  setAuthCookies(res, tokens);
  return res;
}
