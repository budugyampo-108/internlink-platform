import { createHash } from 'node:crypto';
import {
  canonicalEvaluationPayload,
  evaluationSubmitSchema,
  studentEvaluationRequestSchema,
} from '@internlink/shared';
import { prisma } from '@/lib/db';
import { HttpError, ok, readJson, route } from '@/lib/http';
import { requireSession } from '@/lib/auth';
import { loadParticipantApplication } from '@/lib/access';
import { audit } from '@/lib/audit';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/* ───────────────────────── READ (both participants; read-only for everyone) ───────────────────────── */
export const GET = route<{ applicationId: string }>(async (req, { params }) => {
  const s = await requireSession(req);
  const app = await loadParticipantApplication(params.applicationId, s);

  const e = await prisma.evaluation.findUnique({
    where: { applicationId: app.id },
    include: { application: false },
  });
  if (!e) return ok({ evaluation: null, applicationStatus: app.status });

  let submittedByName: string | null = null;
  if (e.submittedById) {
    submittedByName = (await prisma.user.findUnique({ where: { id: e.submittedById }, select: { fullName: true } }))?.fullName ?? null;
  }

  // Tamper-evidence: recompute the hash from stored values and compare.
  let integrity: 'ok' | 'mismatch' | 'n/a' = 'n/a';
  if (e.status === 'SUBMITTED' && e.scores && e.remarks !== null && e.submittedAt && e.submittedById && e.contentHash) {
    const expected = sha256(
      canonicalEvaluationPayload({
        applicationId: e.applicationId,
        submittedById: e.submittedById,
        submittedAtIso: e.submittedAt.toISOString(),
        scores: e.scores as Record<string, number>,
        remarks: e.remarks,
        recommend: Boolean(e.recommend),
        responseDocId: e.responseDocId,
      }),
    );
    integrity = expected === e.contentHash ? 'ok' : 'mismatch';
  }

  return ok({
    applicationStatus: app.status,
    evaluation: {
      id: e.id,
      status: e.status,
      locked: e.status === 'SUBMITTED',
      requestedAt: e.requestedAt,
      formDocId: e.formDocId,
      // Result fields are only present after HR submission — same payload for student & HR.
      scores: e.scores,
      remarks: e.remarks,
      recommend: e.recommend,
      responseDocId: e.responseDocId,
      submittedAt: e.submittedAt,
      submittedByName,
      contentHash: e.contentHash,
      integrity,
    },
  });
});

/* ───────────────────────── WRITE ─────────────────────────
   STUDENT → may only swap the form file, and only while REQUESTED.
   COMPANY → may submit exactly once (REQUESTED → SUBMITTED). After that: 409 for everyone.
   Three independent layers: (1) role check here, (2) status-conditional UPDATE, (3) DB trigger. */
export const PATCH = route<{ applicationId: string }>(async (req, { params }) => {
  const s = await requireSession(req);
  const app = await loadParticipantApplication(params.applicationId, s); // 404 for non-participants

  /* ── Student path ── */
  if (s.role === 'STUDENT') {
    // `.strict()` → any attempt to send scores/remarks/status/submittedAt/etc. is a 400, never silently ignored.
    const { formDocId } = await readJson(req, studentEvaluationRequestSchema);
    const doc = await prisma.document.findFirst({ where: { id: formDocId, ownerId: s.userId, kind: 'EVAL_FORM' } });
    if (!doc) throw new HttpError(400, 'Invalid evaluation form file', 'VALIDATION');

    const r = await prisma.evaluation.updateMany({
      where: { applicationId: app.id, status: 'REQUESTED' }, // zero rows match once SUBMITTED
      data: { formDocId },
    });
    if (r.count === 0) throw new HttpError(409, 'This evaluation can no longer be changed', 'EVALUATION_LOCKED');
    await audit(prisma, req, s.userId, 'evaluation.replace_form', 'Evaluation', app.id);
    return ok({ updated: true });
  }

  /* ── Company (HR / supervisor) path ── */
  const body = await readJson(req, evaluationSubmitSchema);

  if (body.responseDocId) {
    const d = await prisma.document.findFirst({ where: { id: body.responseDocId, ownerId: s.userId, kind: 'EVAL_RESPONSE' } });
    if (!d) throw new HttpError(400, 'Invalid response file', 'VALIDATION');
  }

  const submittedAt = new Date();
  const contentHash = sha256(
    canonicalEvaluationPayload({
      applicationId: app.id,
      submittedById: s.userId,
      submittedAtIso: submittedAt.toISOString(),
      scores: body.scores,
      remarks: body.remarks,
      recommend: body.recommend,
      responseDocId: body.responseDocId,
    }),
  );

  const submitted = await prisma.$transaction(async (tx) => {
    // Status-conditional UPDATE: only a REQUESTED row can match. A second submit matches 0 rows.
    const r = await tx.evaluation.updateMany({
      where: { applicationId: app.id, status: 'REQUESTED' },
      data: {
        status: 'SUBMITTED',
        scores: body.scores,
        remarks: body.remarks,
        recommend: body.recommend,
        responseDocId: body.responseDocId ?? null,
        submittedById: s.userId,
        submittedAt,
        contentHash,
      },
    });
    if (r.count === 0) {
      const exists = await tx.evaluation.findUnique({ where: { applicationId: app.id }, select: { status: true } });
      if (!exists) throw new HttpError(409, 'The student has not requested an evaluation yet', 'NOT_REQUESTED');
      throw new HttpError(409, 'This evaluation has already been submitted and is locked', 'EVALUATION_LOCKED');
    }
    await audit(tx, req, s.userId, 'evaluation.submit', 'Evaluation', app.id, { contentHash, recommend: body.recommend });
    return { submittedAt, contentHash };
  });

  return ok({ submitted: true, ...submitted });
});

// Deliberately NO PUT / DELETE handlers: Next.js answers 405 for them.
