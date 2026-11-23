'use client';
import { useEffect, useState } from 'react';
import { applicantRequirementsSchema, type ApplicantRequirements } from '@internlink/shared';
import { api, ApiError } from '@/lib/client';
import { ConfirmDialog } from './ConfirmDialog';

type V = {
  id: string; title: string; description: string; slots: number; slotsFilled: number; requiredSkills: string[];
  applicantRequirements: unknown; availableFrom: string; availableTo: string;
  department: { name: string };
  company: { name: string; overview: string; culture: string; address: string; digitalAddress: string; phone: string; website: string | null; linkedin: string | null; twitter: string | null; instagram: string | null; facebook: string | null; photos: { id: string; url: string }[] };
};

async function upload(file: File, kind: 'INTRO_LETTER' | 'CV' | 'STUDENT_ID') {
  if (file.size > 4 * 1024 * 1024) throw new Error(`${file.name} is larger than 4 MB`);
  const form = new FormData();
  form.set('file', file); form.set('kind', kind);
  return (await api<{ document: { id: string } }>('/api/uploads', { method: 'POST', form })).document.id;
}

export function ApplyForm({ vacancyId }: { vacancyId: string }) {
  const [v, setV] = useState<V | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [coverNote, setCoverNote] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [letter, setLetter] = useState<File | null>(null);
  const [cv, setCv] = useState<File | null>(null);
  const [sid, setSid] = useState<File | null>(null);

  useEffect(() => {
    api<{ vacancy: V }>(`/api/vacancies/${vacancyId}`).then((r) => setV(r.vacancy)).catch((e) => setError(e.message));
  }, [vacancyId]);

  if (error && !v) return <div className="alert error" role="alert">{error}</div>;
  if (!v) return <div aria-busy="true" className="skeleton" style={{ height: 300 }} />;

  const req: ApplicantRequirements = applicantRequirementsSchema.parse(v.applicantRequirements);
  const c = v.company;
  const ready = Boolean(letter) && (!req.cv || cv) && (!req.studentId || sid) && (!req.coverNote || coverNote.trim()) && (!req.availability || (from && to)) && (!req.portfolio || portfolioUrl);

  async function submit() {
    setBusy(true); setError('');
    try {
      const introLetterDocId = await upload(letter!, 'INTRO_LETTER');
      const cvDocId = cv ? await upload(cv, 'CV') : undefined;
      const studentIdDocId = sid ? await upload(sid, 'STUDENT_ID') : undefined;
      const r = await api<{ application: { id: string } }>('/api/applications', {
        method: 'POST',
        json: { vacancyId, coverNote: coverNote || undefined, portfolioUrl: portfolioUrl || undefined, availableFrom: from || undefined, availableTo: to || undefined, introLetterDocId, cvDocId, studentIdDocId },
      });
      window.location.assign(`/student/applications/${r.application.id}`);
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'CONFLICT' ? 'You have already applied to this vacancy.' : e instanceof Error ? e.message : 'Could not submit');
      setBusy(false); setConfirm(false);
    }
  }

  const social = [['Website', c.website], ['LinkedIn', c.linkedin], ['X / Twitter', c.twitter], ['Instagram', c.instagram], ['Facebook', c.facebook]].filter(([, u]) => u) as [string, string][];

  return (
    <div className="grid-2">
      <section className="card stack" aria-labelledby="co">
        <h1 id="co" style={{ fontSize: '1.5rem' }}>{v.title}</h1>
        <p className="muted">{c.name} · {v.department.name} · {v.slots - v.slotsFilled} slot(s) left</p>
        <p>{v.description}</p>
        <div className="row" style={{ gap: '.35rem' }}>{v.requiredSkills.map((s) => <span key={s} className="chip">{s}</span>)}</div>
        <h2 style={{ fontSize: '1.1rem' }}>About {c.name}</h2>
        {c.overview && <p>{c.overview}</p>}
        {c.culture && <p className="muted"><strong>Culture:</strong> {c.culture}</p>}
        <p className="small"><strong>Address:</strong> {c.address} · <span className="mono">{c.digitalAddress}</span><br /><strong>Phone:</strong> <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a></p>
        {social.length > 0 && <p className="small row">{social.map(([n, u]) => <a key={n} href={u} target="_blank" rel="noopener noreferrer">{n}</a>)}</p>}
        {c.photos.length > 0 && <div className="row">{c.photos.map((p) => <img key={p.id} src={p.url} alt={`${c.name} workplace`} width={120} height={80} style={{ objectFit: 'cover', borderRadius: 8 }} loading="lazy" />)}</div>}
      </section>

      <form className="card" onSubmit={(e) => { e.preventDefault(); if (ready) setConfirm(true); }} aria-labelledby="ap">
        <h2 id="ap">Apply</h2>
        <p className="hint">This company asks for the items marked <strong>required</strong>.</p>
        {error && <div className="alert error" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="field"><label htmlFor="letter">Internship introductory letter <em>(required)</em></label>
          <input id="letter" className="input" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={(e) => setLetter(e.target.files?.[0] ?? null)} /><span className="hint">PDF, DOCX, PNG or JPG · max 4 MB</span></div>
        {req.cv && <div className="field"><label htmlFor="cv">CV / résumé <em>(required)</em></label><input id="cv" className="input" type="file" accept=".pdf,.docx" onChange={(e) => setCv(e.target.files?.[0] ?? null)} /></div>}
        {req.studentId && <div className="field"><label htmlFor="sid">Student ID photo <em>(required)</em></label><input id="sid" className="input" type="file" accept=".png,.jpg,.jpeg" onChange={(e) => setSid(e.target.files?.[0] ?? null)} /></div>}
        {req.availability && (
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="from">Available from <em>(required)</em></label><input id="from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="to">Available until <em>(required)</em></label><input id="to" className="input" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        )}
        {req.portfolio && <div className="field"><label htmlFor="pf">Portfolio link <em>(required)</em></label><input id="pf" className="input" type="url" placeholder="https://" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} /></div>}
        {req.coverNote && <div className="field"><label htmlFor="cn">Cover note <em>(required)</em></label><textarea id="cn" className="input" maxLength={1500} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} /></div>}
        <p className="hint">Your program, level and institution are shared from your profile.</p>
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={!ready || busy}>Review &amp; submit</button>

        <ConfirmDialog open={confirm} title={`Apply to ${c.name}?`} confirmLabel="Submit application" busy={busy} onConfirm={submit} onCancel={() => setConfirm(false)}>
          Your documents will be uploaded and visible to {c.name}’s HR team.
        </ConfirmDialog>
      </form>
    </div>
  );
}
