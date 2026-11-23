import { z } from 'zod';
import { studentEvaluationRequestSchema } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { HttpError, ok, readJson, route } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { loadParticipantApplication } from '@/lib/access';
import { audit } from '@/lib/audit';

const createSchema = studentEvaluationRequestSchema.extend({ applicationId: z.string().min(20).max(40) }).strict();

/**
 * STUDENT initiates the post-attachment evaluation by attaching the form HR should open/fill.
 * This is the ONLY write a student can ever make to an evaluation row (see PATCH for the
 * narrow "replace form while still REQUESTED" path).
 */
export const POST = route(async (req) => {
  const s = await requireRole(req, 'STUDENT');
  const { applicationId, formDocId } = await readJson(req, createSchema);
  const app = await loadParticipantApplication(applicationId, s);

  if (app.status !== 'COMPLETED') {
    throw new HttpError(409, 'The evaluation opens once HR marks your attachment as completed', 'NOT_COMPLETED');
  }
  const doc = await prisma.document.findFirst({ where: { id: formDocId, ownerId: s.userId, kind: 'EVAL_FORM' } });
  if (!doc) throw new HttpError(400, 'Invalid evaluation form file', 'VALIDATION');

  const evaluation = await prisma.$transaction(async (tx) => {
    const e = await tx.evaluation.create({
      data: { applicationId, formDocId, requestedById: s.userId, status: 'REQUESTED' },
    });
    await audit(tx, req, s.userId, 'evaluation.request', 'Evaluation', e.id, { applicationId });
    return e;
  });
  return ok({ evaluation: { id: evaluation.id, status: evaluation.status } }, 201);
});
