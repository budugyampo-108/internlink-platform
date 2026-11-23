import { registerSchema } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { clientIp, HttpError, readJson, route } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { hashPassword, issueTokens } from '@/lib/auth';
import { sessionResponse } from '@/lib/session-response';
import { audit } from '@/lib/audit';

export const POST = route(async (req) => {
  await rateLimit('register', clientIp(req), 10, 3600);
  const body = await readJson(req, registerSchema);

  if (await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })) {
    // Trade-off: explicit message is friendlier; use a generic message if enumeration is a concern.
    throw new HttpError(409, 'An account with this email already exists', 'CONFLICT');
  }
  const passwordHash = await hashPassword(body.password);

  const { user, companyId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: body.email, passwordHash, role: body.role, fullName: body.fullName },
    });
    let companyId: string | undefined;
    if (body.role === 'STUDENT') {
      await tx.studentProfile.create({
        data: { userId: user.id, institution: body.institution, program: body.program, level: body.level },
      });
    } else {
      const company = await tx.company.create({ data: { name: body.companyName, industry: body.industry } });
      await tx.companyMember.create({ data: { userId: user.id, companyId: company.id, jobTitle: body.jobTitle } });
      companyId = company.id;
    }
    await audit(tx, req, user.id, 'user.register', 'User', user.id, { role: body.role });
    return { user, companyId };
  });

  const tokens = await issueTokens(user, companyId);
  return sessionResponse(req, { id: user.id, role: user.role, fullName: user.fullName, email: user.email }, tokens, 201);
});
