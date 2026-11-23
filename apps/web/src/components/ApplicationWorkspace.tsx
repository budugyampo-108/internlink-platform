'use client';
import { useCallback, useEffect, useState } from 'react';
import { STATUS_TRANSITIONS, type ApplicationStatus, type Role } from '@internlink/shared';
import { api } from '@/lib/client';
import { ChatPanel } from './ChatPanel';
import { EvaluationPanel } from './EvaluationPanel';
import { ConfirmDialog } from './ConfirmDialog';

type Detail = {
  application: {
    id: string; status: ApplicationStatus; coverNote: string | null; vacancyTitle: string; companyName: string; departmentName: string;
    student: { fullName: string; student: { institution: string; program: string; level: number; skills: string[]; bio: string } | null };
    documents: { introLetter: string; cv: string | null; studentId: string | null };
  };
  me: { userId: string; role: Role };
};

const LABEL: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Submitted', REVIEWING: 'Mark as reviewing', SHORTLISTED: 'Shortlist', ACCEPTED: 'Accept', REJECTED: 'Reject', WITHDRAWN: 'Withdraw application', COMPLETED: 'Mark attachment completed',
};
const BADGE: Record<ApplicationStatus, string> = { SUBMITTED: '', REVIEWING: '', SHORTLISTED: 'ok', ACCEPTED: 'ok', REJECTED: 'danger', WITHDRAWN: 'danger', COMPLETED: 'lock' };
const NEEDS_CONFIRM = new Set<ApplicationStatus>(['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'COMPLETED']);

export function ApplicationWorkspace({ applicationId, role }: { applicationId: string; role: Role }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<ApplicationStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setD(await api<Detail>(`/api/applications/${applicationId}`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, [applicationId]);
  useEffect(() => { load(); }, [load]);

  async function change(status: ApplicationStatus) {
    setBusy(true); setError('');
    try { await api(`/api/applications/${applicationId}`, { method: 'PATCH', json: { status } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(false); setPending(null); }
  }

  if (error && !d) return <div className="alert error" role="alert">{error}</div>;
  if (!d) return <div aria-busy="true" className="stack"><div className="skeleton" style={{ height: 60 }} /><div className="skeleton" style={{ height: 400 }} /></div>;

  const a = d.application;
  const actions = STATUS_TRANSITIONS[a.status][role];
  const counterpart = role === 'STUDENT' ? `${a.companyName} HR` : a.student.fullName;

  return (
    <div className="stack">
      <section className="card stack" aria-labelledby="app-h">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 id="app-h" style={{ fontSize: '1.5rem' }}>{a.vacancyTitle}</h1>
            <p className="muted" style={{ margin: 0 }}>{a.companyName} · {a.departmentName}{role === 'COMPANY' && ` · Applicant: ${a.student.fullName}`}</p>
          </div>
          <span className={`badge ${BADGE[a.status]}`}>{a.status.charAt(0) + a.status.slice(1).toLowerCase()}</span>
        </div>

        {role === 'COMPANY' && (
          <div className="small">
            {a.student.student && <p style={{ margin: 0 }}>{a.student.student.program} · Level {a.student.student.level} · {a.student.student.institution}</p>}
            {a.coverNote && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>“{a.coverNote}”</p>}
            <div className="row">
              <a className="btn" href={`/api/documents/${a.documents.introLetter}`} target="_blank" rel="noreferrer">Introductory letter</a>
              {a.documents.cv && <a className="btn" href={`/api/documents/${a.documents.cv}`} target="_blank" rel="noreferrer">CV</a>}
              {a.documents.studentId && <a className="btn" href={`/api/documents/${a.documents.studentId}`} target="_blank" rel="noreferrer">Student ID</a>}
            </div>
          </div>
        )}

        {error && <div className="alert error" role="alert">{error}</div>}
        {actions.length > 0 && (
          <div className="row">
            {actions.map((s) => (
              <button key={s} className={`btn ${s === 'REJECTED' || s === 'WITHDRAWN' ? '' : 'btn-primary'}`} disabled={busy} onClick={() => (NEEDS_CONFIRM.has(s) ? setPending(s) : change(s))}>
                {LABEL[s]}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid-2">
        <ChatPanel applicationId={applicationId} counterpart={counterpart} />
        <EvaluationPanel applicationId={applicationId} role={role} applicationStatus={a.status} />
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `${LABEL[pending]}?` : ''}
        confirmLabel="Yes, continue"
        danger={pending === 'REJECTED' || pending === 'WITHDRAWN'}
        busy={busy}
        onConfirm={() => pending && change(pending)}
        onCancel={() => setPending(null)}
      >
        {pending === 'ACCEPTED' && 'This uses one slot in the vacancy.'}
        {pending === 'COMPLETED' && 'This tells the student they can now send their evaluation form.'}
        {(pending === 'REJECTED' || pending === 'WITHDRAWN') && 'This closes the conversation and cannot be undone.'}
      </ConfirmDialog>
    </div>
  );
}
