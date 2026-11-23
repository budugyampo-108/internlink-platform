import { applicantRequirementsSchema, applicationCreateSchema } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { HttpError, ok, readJson, route } from '@/lib/http';
import { requireRole, requireSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

export const GET = route(async (req) => {
  const s = await requireSession(req);
  const where = s.role === 'STUDENT' ? { studentId: s.userId } : { vacancy: { companyId: s.companyId! } };
  const applications = await prisma.application.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      vacancy: { select: { title: true, company: { select: { name: true } }, department: { select: { name: true } } } },
      student: {
        select: { fullName: true, student: { select: { institution: true, program: true, level: true } } },
      },
      evaluation: { select: { status: true } },
    },
  });
  return ok({ applications });
});

export const POST = route(async (req) => {
  const s = await requireRole(req, 'STUDENT');
  await rateLimit('apply', s.userId, 20, 3600);
  const body = await readJson(req, applicationCreateSchema);

  const vacancy = await prisma.vacancy.findFirst({ where: { id: body.vacancyId, status: 'OPEN' } });
  if (!vacancy || vacancy.slotsFilled >= vacancy.slots) throw new HttpError(404, 'This vacancy is no longer open', 'NOT_FOUND');

  // Enforce the company's configured applicant requirements.
  const req_ = applicantRequirementsSchema.parse(vacancy.applicantRequirements);
  const missing: string[] = [];
  if (req_.coverNote && !body.coverNote) missing.push('coverNote');
  if (req_.cv && !body.cvDocId) missing.push('cvDocId');
  if (req_.studentId && !body.studentIdDocId) missing.push('studentIdDocId');
  if (req_.availability && !(body.availableFrom && body.availableTo)) missing.push('availability');
  if (req_.portfolio && !body.portfolioUrl) missing.push('portfolioUrl');
  if (missing.length) throw new HttpError(400, `Missing required: ${missing.join(', ')}`, 'REQUIREMENTS_MISSING');

  // Referenced documents must be the student's own, and of the right kind.
  const wanted: [string | undefined, 'INTRO_LETTER' | 'CV' | 'STUDENT_ID'][] = [
    [body.introLetterDocId, 'INTRO_LETTER'],
    [body.cvDocId, 'CV'],
    [body.studentIdDocId, 'STUDENT_ID'],
  ];
  for (const [id, kind] of wanted) {
    if (!id) continue;
    const doc = await prisma.document.findFirst({ where: { id, ownerId: s.userId, kind }, select: { id: true } });
    if (!doc) throw new HttpError(400, `Invalid ${kind} document`, 'VALIDATION');
  }

  const application = await prisma.$transaction(async (tx) => {
    const a = await tx.application.create({ data: { ...body, studentId: s.userId } }); // unique(vacancyId, studentId) → 409 on duplicates
    await audit(tx, req, s.userId, 'application.create', 'Application', a.id, { vacancyId: a.vacancyId });
    return a;
  });
  return ok({ application }, 201);
});
