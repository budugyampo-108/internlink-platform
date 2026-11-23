import { prisma } from '@/lib/db';
import { ok, route, HttpError } from '@/lib/http';
import { requireSession } from '@/lib/auth';

export const GET = route(async (req) => {
  const s = await requireSession(req);
  const user = await prisma.user.findUnique({
    where: { id: s.userId },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      student: { select: { institution: true, program: true, level: true, skills: true, vacationLat: true, vacationLng: true, homeLat: true, homeLng: true } },
      companyMember: { select: { jobTitle: true, company: { select: { id: true, name: true } } } },
    },
  });
  if (!user) throw new HttpError(401, 'Please sign in', 'UNAUTHENTICATED');
  return ok({ user });
});
