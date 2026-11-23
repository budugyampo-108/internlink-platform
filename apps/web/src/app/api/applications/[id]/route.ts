import { applicationStatusSchema, STATUS_TRANSITIONS } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { HttpError, ok, readJson, route } from '@/lib/http';
import { requireSession } from '@/lib/auth';
import { loadParticipantApplication } from '@/lib/access';
import { audit } from '@/lib/audit';

export const GET = route<{ id: string }>(async (req, { params }) => {
  const s = await requireSession(req);
  const app = await loadParticipantApplication(params.id, s);
  const full = await prisma.application.findUniqueOrThrow({
    where: { id: app.id },
    include: {
      student: { select: { fullName: true, student: { select: { institution: true, program: true, level: true, skills: true, bio: true } } } },
    },
  });
  return ok({
    application: {
      id: full.id,
      status: full.status,
      coverNote: full.coverNote,
      createdAt: full.createdAt,
      vacancyTitle: app.vacancy.title,
      companyName: app.vacancy.company.name,
      departmentName: app.vacancy.department.name,
      student: full.student,
      documents: {
        introLetter: full.introLetterDocId,
        cv: full.cvDocId,
        studentId: full.studentIdDocId,
      },
    },
    me: { userId: s.userId, role: s.role },
  });
});

/** Status changes — the only way slots are consumed or released. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const s = await requireSession(req);
  const { status: next } = await readJson(req, applicationStatusSchema);
  await loadParticipantApplication(params.id, s); // 404 unless caller is a participant

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id: params.id }, include: { vacancy: true } });
    if (!STATUS_TRANSITIONS[app.status][s.role].includes(next)) {
      throw new HttpError(409, `Cannot change status from ${app.status} to ${next}`, 'INVALID_TRANSITION');
    }

    if (next === 'ACCEPTED') {
      // Atomic slot claim: succeeds only while slotsFilled < slots (DB CHECK is the backstop).
      const claim = await tx.vacancy.updateMany({
        where: { id: app.vacancyId, status: 'OPEN', slotsFilled: { lt: app.vacancy.slots } },
        data: { slotsFilled: { increment: 1 } },
      });
      if (claim.count === 0) throw new HttpError(409, 'No slots left in this vacancy', 'NO_SLOTS');
    }
    if (app.status === 'ACCEPTED' && next === 'WITHDRAWN') {
      await tx.vacancy.updateMany({ where: { id: app.vacancyId, slotsFilled: { gt: 0 } }, data: { slotsFilled: { decrement: 1 } } });
    }

    // Optimistic guard against concurrent changes.
    const r = await tx.application.updateMany({ where: { id: app.id, status: app.status }, data: { status: next } });
    if (r.count === 0) throw new HttpError(409, 'Application was changed by someone else — refresh and retry', 'CONFLICT');

    await audit(tx, req, s.userId, 'application.status', 'Application', app.id, { from: app.status, to: next, by: s.role });
    return { id: app.id, status: next };
  });
  return ok({ application: updated });
});
