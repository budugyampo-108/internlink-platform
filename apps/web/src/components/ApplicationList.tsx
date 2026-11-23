'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Role } from '@internlink/shared';
import { api, fmtDate } from '@/lib/client';

type Row = {
  id: string; status: string; updatedAt: string;
  vacancy: { title: string; company: { name: string }; department: { name: string } };
  student: { fullName: string; student: { institution: string; program: string; level: number } | null };
  evaluation: { status: string } | null;
};

export function ApplicationList({ role }: { role: Role }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ applications: Row[] }>('/api/applications').then((r) => setRows(r.applications)).catch((e) => { setError(e.message); setRows([]); });
  }, []);

  const base = role === 'STUDENT' ? '/student/applications' : '/company/applications';
  return (
    <div className="stack">
      <h1 style={{ fontSize: '1.6rem' }}>{role === 'STUDENT' ? 'My applications' : 'Applications to your vacancies'}</h1>
      {error && <div className="alert error" role="alert">{error}</div>}
      {rows === null && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 78 }} aria-hidden />)}
      {rows?.length === 0 && !error && (
        <div className="empty card">
          <h3>Nothing here yet</h3>
          <p>{role === 'STUDENT' ? 'Find a company near you and apply.' : 'Applications will appear here once students apply.'}</p>
          {role === 'STUDENT' && <Link className="btn btn-primary" href="/student">Discover nearby</Link>}
        </div>
      )}
      {rows?.map((r) => (
        <Link key={r.id} href={`${base}/${r.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{r.vacancy.title}</strong>
              <div className="muted small">
                {role === 'STUDENT' ? `${r.vacancy.company.name} · ${r.vacancy.department.name}` : `${r.student.fullName}${r.student.student ? ` · ${r.student.student.program} (L${r.student.student.level})` : ''}`}
              </div>
            </div>
            <div className="row">
              {r.evaluation && <span className={`badge ${r.evaluation.status === 'SUBMITTED' ? 'lock' : 'warn'}`}>{r.evaluation.status === 'SUBMITTED' ? '🔒 Evaluated' : 'Evaluation pending'}</span>}
              <span className="badge">{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span>
            </div>
          </div>
          <div className="hint" style={{ marginTop: '.4rem' }}>Updated {fmtDate(r.updatedAt)}</div>
        </Link>
      ))}
    </div>
  );
}
