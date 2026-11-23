import { companyProfileSchema } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { ok, readJson, route, HttpError } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';

/** Company onboarding profile. Only members of THAT company can read/write it (companyId comes from the token, never the client). */
export const GET = route(async (req) => {
  const s = await requireRole(req, 'COMPANY');
  const company = await prisma.company.findUnique({
    where: { id: s.companyId! },
    include: { photos: { select: { id: true, url: true } }, departments: true },
  });
  return ok({ company });
});

export const PUT = route(async (req) => {
  const s = await requireRole(req, 'COMPANY');
  const { photoDocIds, ...profile } = await readJson(req, companyProfileSchema);

  const docs = photoDocIds.length
    ? await prisma.document.findMany({ where: { id: { in: photoDocIds }, ownerId: s.userId, kind: 'COMPANY_PHOTO' } })
    : [];
  if (docs.length !== photoDocIds.length) throw new HttpError(400, 'One or more photos are invalid', 'VALIDATION');

  const company = await prisma.$transaction(async (tx) => {
    const c = await tx.company.update({ where: { id: s.companyId! }, data: profile });
    await tx.companyPhoto.deleteMany({ where: { companyId: c.id } });
    if (docs.length) {
      await tx.companyPhoto.createMany({ data: docs.map((d) => ({ companyId: c.id, documentId: d.id, url: d.url })) });
    }
    await audit(tx, req, s.userId, 'company.update', 'Company', c.id);
    return c;
  });
  return ok({ company });
});
