import { loginSchema } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { clientIp, HttpError, readJson, route } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { issueTokens, verifyPassword } from '@/lib/auth';
import { sessionResponse } from '@/lib/session-response';
import { audit } from '@/lib/audit';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const POST = route(async (req) => {
  await rateLimit('login-ip', clientIp(req), 20, 600);
  const { email, password } = await readJson(req, loginSchema);
  await rateLimit('login-email', email, 8, 900);

  const user = await prisma.user.findUnique({ where: { email }, include: { companyMember: true } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.', 'ACCOUNT_LOCKED');
  }

  const valid = await verifyPassword(password, user?.passwordHash); // constant-ish time even for unknown emails
  if (!user || !valid || !user.isActive) {
    if (user) {
      const failed = user.failedLogins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed >= MAX_FAILED ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
    }
    throw new HttpError(401, 'Incorrect email or password', 'INVALID_CREDENTIALS'); // same message either way
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  const tokens = await issueTokens(user, user.companyMember?.companyId);
  await audit(prisma, req, user.id, 'auth.login', 'User', user.id);
  return sessionResponse(req, { id: user.id, role: user.role, fullName: user.fullName, email: user.email }, tokens);
});
