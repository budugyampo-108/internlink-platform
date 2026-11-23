import { prisma } from '@/lib/db';
import { HttpError, ok, route } from '@/lib/http';
import { requireSession } from '@/lib/auth';

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireSession(req);
  const v = await prisma.vacancy.findFirst({
    where: { id: params.id, status: 'OPEN' },
    include: {
      department: { select: { name: true } },
      company: {
        select: {
          id: true, name: true, overview: true, industry: true, culture: true, address: true, digitalAddress: true, phone: true,
          lat: true, lng: true, linkedin: true, twitter: true, instagram: true, facebook: true, website: true,
          photos: { select: { id: true, url: true } },
        },
      },
    },
  });
  if (!v) throw new HttpError(404, 'Vacancy not found', 'NOT_FOUND');
  return ok({ vacancy: v });
});
