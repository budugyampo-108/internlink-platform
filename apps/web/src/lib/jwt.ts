// Edge-safe (uses only `jose`) — imported by middleware AND route handlers.
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@internlink/shared';

export type Session = { userId: string; role: Role; companyId?: string };

export const ACCESS_COOKIE = 'il_at';
export const REFRESH_COOKIE = 'il_rt';
export const ACCESS_TTL_SECONDS = 15 * 60; // short-lived; refresh token rotates sessions
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

const ISSUER = 'internlink';
const AUDIENCE = 'internlink-api';

function secretKey(): Uint8Array {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set to a random string of at least 32 characters');
  }
  return new TextEncoder().encode(s);
}

export async function signAccessToken(s: Session): Promise<string> {
  return new SignJWT({ role: s.role, cid: s.companyId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    const role = payload.role;
    if (!payload.sub || (role !== 'STUDENT' && role !== 'COMPANY')) return null;
    return {
      userId: payload.sub,
      role,
      companyId: typeof payload.cid === 'string' ? payload.cid : undefined,
    };
  } catch {
    return null;
  }
}
