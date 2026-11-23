import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { HttpError } from './http';
import type { Session } from './jwt';

const appInclude = {
  vacancy: { include: { company: { select: { id: true, name: true } }, department: { select: { name: true } } } },
  student: { select: { id: true, fullName: true } },
} satisfies Prisma.ApplicationInclude;

export type AppWithRefs = Prisma.ApplicationGetPayload<{ include: typeof appInclude }>;

/**
 * Loads an application ONLY if the caller is a participant:
 *   – the student who applied, or
 *   – a member of the company that owns the vacancy.
 * Anything else → 404 (never reveals that the record exists).
 */
export async function loadParticipantApplication(applicationId: string, s: Session): Promise<AppWithRefs> {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: appInclude });
  const isParticipant =
    app &&
    ((s.role === 'STUDENT' && app.studentId === s.userId) ||
      (s.role === 'COMPANY' && s.companyId === app.vacancy.companyId));
  if (!app || !isParticipant) throw new HttpError(404, 'Not found', 'NOT_FOUND');
  return app;
}

/** Can this session read this document? Owner, or the counter-party on the linked application. */
export async function canReadDocument(docId: string, s: Session): Promise<boolean> {
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) return false;
  if (doc.ownerId === s.userId) return true;
  if (doc.kind === 'COMPANY_PHOTO') return true; // public gallery photos

  if (s.role === 'COMPANY' && s.companyId) {
    const linked = await prisma.application.findFirst({
      where: {
        vacancy: { companyId: s.companyId },
        OR: [{ introLetterDocId: docId }, { cvDocId: docId }, { studentIdDocId: docId }, { evaluation: { formDocId: docId } }],
      },
      select: { id: true },
    });
    return Boolean(linked);
  }
  if (s.role === 'STUDENT') {
    // Student may read the HR response attached to THEIR OWN evaluation (read-only).
    const linked = await prisma.evaluation.findFirst({
      where: { responseDocId: docId, application: { studentId: s.userId } },
      select: { id: true },
    });
    return Boolean(linked);
  }
  return false;
}
