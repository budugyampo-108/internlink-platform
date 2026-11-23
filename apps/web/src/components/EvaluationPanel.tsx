'use client';
/**
 * Post-attachment evaluation — role-aware and LOCKED after HR submission.
 *
 *  UI layer of the lock:
 *    • Student: can only (a) attach the form to start it, or (b) read the result. When the
 *      evaluation is SUBMITTED no <input>/<textarea> is rendered at all — nothing to tamper with.
 *    • HR: sees the form once; after submit the same view becomes read-only.
 *  The server (role check + status-conditional UPDATE) and the database (trigger) enforce it for real;
 *  this component is only the honest reflection of that state.
 */
import { useCallback, useEffect, useState } from 'react';
import { EVALUATION_CRITERIA, type Role } from '@internlink/shared';
import { api, ApiError, fmtDate } from '@/lib/client';
import { ConfirmDialog } from './ConfirmDialog';

type Evaluation = {
  id: string; status: 'REQUESTED' | 'SUBMITTED'; locked: boolean; requestedAt: string; formDocId: string;
  scores: Record<string, number> | null; remarks: string | null; recommend: boolean | null; responseDocId: string | null;
  submittedAt: string | null; submittedByName: string | null; contentHash: string | null; integrity: 'ok' | 'mismatch' | 'n/a';
};

async function upload(file: File, kind: 'EVAL_FORM' | 'EVAL_RESPONSE') {
  if (file.size > 4 * 1024 * 1024) throw new Error('File is too large (max 4 MB)');
  const form = new FormData();
  form.set('file', file); form.set('kind', kind);
  return (await api<{ document: { id: string } }>('/api/uploads', { method: 'POST', form })).document.id;
}

export function EvaluationPanel({ applicationId, role, applicationStatus, onChange }: { applicationId: string; role: Role; applicationStatus: string; onChange?: () => void }) {
  const [ev, setEv] = useState<Evaluation | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState('');
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    try { setEv((await api<{ evaluation: Evaluation | null }>(`/api/evaluations/${applicationId}`)).evaluation); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load evaluation'); setEv(null); }
  }, [applicationId]);
  useEffect(() => { load(); }, [load, applicationStatus]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError('');
    try { await fn(); await load(); onChange?.(); }
    catch (e) { setError(e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(false); setConfirm(false); }
  }

  const startEvaluation = () => run(async () => {
    if (!file) throw new Error('Choose the evaluation form first');
    const formDocId = await upload(file, 'EVAL_FORM');
    await api('/api/evaluations', { method: 'POST', json: { applicationId, formDocId } });
    setFile(null);
  });

  const submitEvaluation = () => run(async () => {
    const responseDocId = responseFile ? await upload(responseFile, 'EVAL_RESPONSE') : undefined;
    await api(`/api/evaluations/${applicationId}`, {
      method: 'PATCH',
      json: { scores, remarks, recommend, responseDocId, confirm: true },
    });
  });

  const complete = EVALUATION_CRITERIA.every((c) => scores[c.key]) && remarks.trim().length >= 10 && recommend !== null;

  /* ───────── render ───────── */
  if (ev === undefined) return <section className="card" aria-busy="true"><div className="skeleton" style={{ height: 22, width: '50%' }} /><div className="skeleton" style={{ height: 80, marginTop: 12 }} /></section>;

  return (
    <section className="card stack" aria-labelledby="eval-h">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="eval-h" style={{ margin: 0, fontSize: '1.2rem' }}>Attachment evaluation</h2>
        {ev?.locked && <span className="badge lock">🔒 Submitted &amp; locked</span>}
        {ev && !ev.locked && <span className="badge warn">Awaiting HR</span>}
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}

      {/* 1 — Nothing started */}
      {!ev && applicationStatus !== 'COMPLETED' && (
        <p className="muted">The evaluation opens once HR marks your attachment as <strong>Completed</strong>.</p>
      )}
      {!ev && applicationStatus === 'COMPLETED' && role === 'STUDENT' && (
        <div className="stack">
          <p className="muted">Your attachment is complete. Upload the evaluation form your institution requires so HR or your supervisor can open, fill it in and submit it here.</p>
          <div className="field">
            <label htmlFor="evform">Evaluation form (PDF, DOCX, PNG or JPG · max 4 MB)</label>
            <input id="evform" className="input" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <button className="btn btn-primary" disabled={!file || busy} onClick={startEvaluation}>{busy ? 'Uploading…' : 'Send form to HR'}</button>
        </div>
      )}
      {!ev && applicationStatus === 'COMPLETED' && role === 'COMPANY' && <p className="muted">Waiting for the student to send their evaluation form.</p>}

      {/* 2 — Requested, not yet submitted */}
      {ev && !ev.locked && role === 'STUDENT' && (
        <div className="alert info">
          HR has your form (sent {fmtDate(ev.requestedAt)}). Once they submit it, the result appears here as <strong>read-only</strong>. You will not be able to edit it.
        </div>
      )}
      {ev && !ev.locked && role === 'COMPANY' && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (complete) setConfirm(true); }}>
          <p><a className="btn" href={`/api/documents/${ev.formDocId}`} target="_blank" rel="noreferrer">⬇ Open student’s form</a></p>
          <fieldset className="scores" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, marginBottom: '.5rem' }}>Rate each area (1 = poor, 5 = excellent)</legend>
            {EVALUATION_CRITERIA.map((c) => (
              <div key={c.key} className="score-row" role="radiogroup" aria-label={c.label}>
                <span>{c.label}</span>
                <div className="score-opts">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n}>
                      <input type="radio" name={c.key} value={n} checked={scores[c.key] === n} onChange={() => setScores((s) => ({ ...s, [c.key]: n }))} />
                      <span>{n}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="remarks">Remarks</label>
            <textarea id="remarks" className="input" rows={4} maxLength={3000} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Strengths, areas to grow, overall conduct (min 10 characters)" />
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600 }}>Would you recommend this student?</legend>
            <div className="row">
              {[true, false].map((v) => (
                <label key={String(v)} className="btn" style={recommend === v ? { background: 'var(--brand-soft)', borderColor: 'var(--brand)' } : undefined}>
                  <input type="radio" name="rec" className="sr-only" checked={recommend === v} onChange={() => setRecommend(v)} />{v ? 'Yes' : 'No'}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="resp">Signed / completed copy (optional)</label>
            <input id="resp" className="input" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={(e) => setResponseFile(e.target.files?.[0] ?? null)} />
          </div>
          <button className="btn btn-primary" disabled={!complete || busy}>Review &amp; submit…</button>
          <ConfirmDialog open={confirm} title="Submit final evaluation?" confirmLabel="Submit and lock" busy={busy} danger onConfirm={submitEvaluation} onCancel={() => setConfirm(false)}>
            Once submitted, the evaluation is <strong>sealed</strong>. Neither you nor the student can change it afterwards.
          </ConfirmDialog>
        </form>
      )}

      {/* 3 — Submitted: strictly read-only for BOTH roles (no inputs rendered) */}
      {ev?.locked && (
        <div className="stack">
          <div className="readonly-scores" role="table" aria-label="Scores">
            {EVALUATION_CRITERIA.map((c) => (
              <div key={c.key} role="row"><span role="cell">{c.label}</span><strong role="cell">{ev.scores?.[c.key] ?? '–'} / 5</strong></div>
            ))}
          </div>
          <div><h3>Remarks</h3><p style={{ whiteSpace: 'pre-wrap' }}>{ev.remarks}</p></div>
          <p><strong>Recommended:</strong> {ev.recommend ? 'Yes' : 'No'}</p>
          {ev.responseDocId && <p><a className="btn" href={`/api/documents/${ev.responseDocId}`} target="_blank" rel="noreferrer">⬇ Download HR’s copy</a></p>}
          <div className="lockbar small muted">
            <span>Submitted by <strong>{ev.submittedByName ?? 'HR'}</strong> on {fmtDate(ev.submittedAt)}</span>
            <span className={`badge ${ev.integrity === 'ok' ? 'ok' : 'danger'}`}>{ev.integrity === 'ok' ? '✓ Integrity verified' : '⚠ Integrity check failed'}</span>
          </div>
          <details className="small muted"><summary>Seal (SHA-256)</summary><span className="mono">{ev.contentHash}</span></details>
        </div>
      )}
    </section>
  );
}
