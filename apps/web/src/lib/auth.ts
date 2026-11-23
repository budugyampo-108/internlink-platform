import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import type { Role } from '@internlink/shared';
import { prisma } from './db';
import { HttpError } from './http';
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  signAccessToken,
  verifyAccessToken,
  type Session,
} from './jwt';

export type { Session } from './jwt';

const BCRYPT_ROUNDS = 12;
// Pre-computed hash so login takes the same time whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_ROUNDS);
export const verifyPassword = (pw: string, hash: string | undefined) =>
  bcrypt.compare(pw, hash ?? DUMMY_HASH).then((ok) => ok && Boolean(hash));

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };

export async function issueTokens(user: { id: string; role: Role }, companyId?: string): Promise<Tokens> {
  const refreshToken = randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    },
  });
  const accessToken = await signAccessToken({ userId: user.id, role: user.role, companyId });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

/** Rotate a refresh token. Re-use of an already-rotated token revokes the whole family (theft signal). */
export async function rotateRefreshToken(raw: string): Promise<Tokens> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: { include: { companyMember: true } } },
  });
  if (!row) throw new HttpError(401, 'Invalid session', 'UNAUTHENTICATED');
  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw new HttpError(401, 'Session expired. Please sign in again.', 'UNAUTHENTICATED');
  }
  if (row.expiresAt < new Date() || !row.user.isActive) throw new HttpError(401, 'Session expired', 'UNAUTHENTICATED');

  const claimed = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count === 0) throw new HttpError(401, 'Invalid session', 'UNAUTHENTICATED'); // lost a race
  return issueTokens(row.user, row.user.companyMember?.companyId);
}

export async function revokeRefreshToken(raw: string | undefined) {
  if (!raw) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(raw), revokedAt: null }, data: { revokedAt: new Date() } });
}

/* ── Session extraction: Bearer (mobile) or httpOnly cookie (web) ── */

export async function getSession(req: NextRequest): Promise<Session | null> {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : req.cookies.get(ACCESS_COOKIE)?.value;
  return verifyAccessToken(token);
}

export async function requireSession(req: NextRequest): Promise<Session> {
  const s = await getSession(req);
  if (!s) throw new HttpError(401, 'Please sign in', 'UNAUTHENTICATED');
  return s;
}

/** RBAC gate. 403 (not 404) here because the route itself is role-specific, not a resource lookup. */
export async function requireRole(req: NextRequest, role: Role): Promise<Session> {
  const s = await requireSession(req);
  if (s.role !== role) throw new HttpError(403, 'You do not have permission to do that', 'FORBIDDEN');
  if (role === 'COMPANY' && !s.companyId) throw new HttpError(403, 'No company linked to this account', 'FORBIDDEN');
  return s;
}

/* ── Cookies (web only; mobile uses the JSON tokens + SecureStore) ── */

const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export function setAuthCookies(res: NextResponse, t: Tokens) {
  res.cookies.set(ACCESS_COOKIE, t.accessToken, { ...base, path: '/', maxAge: ACCESS_TTL_SECONDS });
  // Refresh cookie only travels to the auth endpoints.
  res.cookies.set(REFRESH_COOKIE, t.refreshToken, { ...base, path: '/api/auth', maxAge: REFRESH_TTL_SECONDS });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, '', { ...base, path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...base, path: '/api/auth', maxAge: 0 });
}

export { REFRESH_COOKIE };
