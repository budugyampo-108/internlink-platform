'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, fmtDate } from '@/lib/client';

type Vacancy = {
  id: string;
  title: string;
  description: string;
  slots: number;
  slotsFilled: number;
  requiredSkills: string[];
  availableFrom: string;
  availableTo: string;
  status: string;
};

type Department = {
  id: string;
  name: string;
  description: string;
  totalSlots: number;
  requiredSkills: string[];
  vacancies?: Vacancy[];
};

type Company = {
  id: string;
  name: string;
  address: string | null;
  digitalAddress: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  departments: Department[];
};

export default function CompanyVacanciesPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  // New Department Form state
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptSlots, setDeptSlots] = useState(5);
  const [deptSkills, setDeptSkills] = useState('');

  // New Vacancy Form state
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [vacTitle, setVacTitle] = useState('');
  const [vacDesc, setVacDesc] = useState('');
  const [vacSlots, setVacSlots] = useState(2);
  const [vacSkills, setVacSkills] = useState('');
  const [vacFrom, setVacFrom] = useState('');
  const [vacTo, setVacTo] = useState('');
  const [reqCv, setReqCv] = useState(true);
  const [reqStudentId, setReqStudentId] = useState(false);
  const [reqCoverNote, setReqCoverNote] = useState(true);

  function load() {
    setError('');
    api<{ company: Company | null }>('/api/company')
      .then((r) => setCompany(r.company))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load company data'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const skills = deptSkills
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      await api('/api/departments', {
        method: 'POST',
        json: {
          name: deptName.trim(),
          description: deptDesc.trim(),
          totalSlots: Number(deptSlots),
          requiredSkills: skills,
        },
      });
      setSuccess(`Department "${deptName}" created successfully!`);
      setDeptName('');
      setDeptDesc('');
      setDeptSkills('');
      setShowDeptForm(false);
      load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.fields?.[0]?.message || err.message);
      else setError(err instanceof Error ? err.message : 'Could not create department');
    } finally {
      setBusy(false);
    }
  }

  async function createVacancy(e: React.FormEvent) {
    e.preventDefault();
    if (!activeDeptId) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const skills = vacSkills
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      await api('/api/vacancies', {
        method: 'POST',
        json: {
          departmentId: activeDeptId,
          title: vacTitle.trim(),
          description: vacDesc.trim(),
          slots: Number(vacSlots),
          requiredSkills: skills,
          availableFrom: new Date(vacFrom).toISOString(),
          availableTo: new Date(vacTo).toISOString(),
          applicantRequirements: {
            cv: reqCv,
            studentId: reqStudentId,
            coverNote: reqCoverNote,
            program: true,
            level: true,
            institution: true,
            availability: true,
            portfolio: false,
          },
        },
      });
      setSuccess(`Vacancy "${vacTitle}" is now live and advertised to students!`);
      setVacTitle('');
      setVacDesc('');
      setVacSkills('');
      setVacFrom('');
      setVacTo('');
      setActiveDeptId(null);
      load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.fields?.[0]?.message || err.message);
      else setError(err instanceof Error ? err.message : 'Could not create vacancy');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="stack" aria-busy="true">
        <div className="skeleton" style={{ height: 40, width: 240 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  const isLocationConfigured = company?.lat !== null && company?.lng !== null && company?.address && company?.phone;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>Departments &amp; Vacancies</h1>
          <p className="muted" style={{ margin: 0 }}>
            Create departments, specify how many interns you can employ, and publish vacancies that students can apply for.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowDeptForm((s) => !s)}>
          {showDeptForm ? 'Cancel' : '+ Add Department'}
        </button>
      </div>

      {!isLocationConfigured && (
        <div className="alert warn" role="alert">
          <strong>Location required:</strong> You must configure your company location, address, and phone number before publishing vacancies so students can find them on the map.
          <div style={{ marginTop: '.5rem' }}>
            <Link className="btn" href="/company/profile">Complete Company Profile &amp; Location →</Link>
          </div>
        </div>
      )}

      {success && <div className="alert ok" role="alert">{success}</div>}
      {error && <div className="alert error" role="alert">{error}</div>}

      {/* New Department Modal / Form */}
      {showDeptForm && (
        <form onSubmit={createDepartment} className="card stack">
          <h2 style={{ fontSize: '1.2rem' }}>Add a Department</h2>
          <p className="hint">Departments represent the operational units in your company (e.g. IT, Audit, HR) and cap total intern intake.</p>

          <div className="field">
            <label htmlFor="dname">Department Name</label>
            <input id="dname" className="input" required placeholder="e.g. Software Engineering, Accounting & Finance" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="dslots">Total Intern Capacity (Slots)</label>
            <input id="dslots" className="input" type="number" min={1} max={500} required value={deptSlots} onChange={(e) => setDeptSlots(Number(e.target.value))} />
            <span className="hint">Maximum total interns your company can host in this department at one time</span>
          </div>

          <div className="field">
            <label htmlFor="dskills">Target Programs / Required Skills (comma-separated)</label>
            <input id="dskills" className="input" placeholder="e.g. Computer Science, React, Python, Accounting, Excel" value={deptSkills} onChange={(e) => setDeptSkills(e.target.value)} />
            <span className="hint">Used to match students who study relevant subjects</span>
          </div>

          <div className="field">
            <label htmlFor="ddesc">Department Overview</label>
            <textarea id="ddesc" className="input" rows={2} maxLength={500} placeholder="Brief summary of department responsibilities" value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} />
          </div>

          <div className="row">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Create Department'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowDeptForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Department & Vacancies List */}
      {company?.departments?.length === 0 && !showDeptForm && (
        <div className="empty card">
          <h3>No departments created yet</h3>
          <p>Start by adding a department and specifying how many interns it can accommodate.</p>
          <button className="btn btn-primary" onClick={() => setShowDeptForm(true)}>+ Add Department</button>
        </div>
      )}

      {company?.departments?.map((dept) => {
        const vacancies = dept.vacancies ?? [];
        const usedSlots = vacancies.reduce((acc, v) => acc + v.slots, 0);
        const slotsAvailable = dept.totalSlots - usedSlots;

        return (
          <section key={dept.id} className="card stack" style={{ borderLeft: '4px solid var(--brand)' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', margin: 0 }}>{dept.name}</h2>
                <p className="muted small" style={{ margin: '.2rem 0' }}>{dept.description || 'No description provided'}</p>
                <div className="row" style={{ gap: '.3rem', marginTop: '.3rem' }}>
                  {dept.requiredSkills.map((s) => (
                    <span key={s} className="chip">{s}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge ok">{dept.totalSlots} Total Slots</span>
                <div className="small muted" style={{ marginTop: '.3rem' }}>
                  {slotsAvailable > 0 ? `${slotsAvailable} slots unallocated` : 'All department slots allocated'}
                </div>
              </div>
            </div>

            {/* Vacancies inside this department */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '.5rem' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Open Vacancies ({vacancies.length})</h3>
                {isLocationConfigured && slotsAvailable > 0 && activeDeptId !== dept.id && (
                  <button className="btn" onClick={() => { setActiveDeptId(dept.id); setVacSlots(Math.min(2, slotsAvailable)); }}>
                    + Post Vacancy in {dept.name}
                  </button>
                )}
              </div>

              {/* Vacancy Form for this department */}
              {activeDeptId === dept.id && (
                <form onSubmit={createVacancy} className="card stack" style={{ background: 'var(--bg-subtle, #f9fafb)', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '1.1rem', margin: 0 }}>Publish New Vacancy in {dept.name}</h4>
                  <p className="hint">This vacancy will immediately appear on the student map and search list for students to apply.</p>

                  <div className="field">
                    <label htmlFor="vtitle">Vacancy Title</label>
                    <input id="vtitle" className="input" required placeholder="e.g. Junior Web Developer Intern" value={vacTitle} onChange={(e) => setVacTitle(e.target.value)} />
                  </div>

                  <div className="field">
                    <label htmlFor="vdesc">Role Description</label>
                    <textarea id="vdesc" className="input" required minLength={10} maxLength={3000} rows={3} placeholder="What will the student be working on during their attachment?" value={vacDesc} onChange={(e) => setVacDesc(e.target.value)} />
                  </div>

                  <div className="row">
                    <div className="field" style={{ flex: 1 }}>
                      <label htmlFor="vslots">Slots for this role (max {slotsAvailable})</label>
                      <input id="vslots" className="input" type="number" min={1} max={slotsAvailable} required value={vacSlots} onChange={(e) => setVacSlots(Number(e.target.value))} />
                    </div>
                    <div className="field" style={{ flex: 2 }}>
                      <label htmlFor="vskills">Required Skills / Field of Study</label>
                      <input id="vskills" className="input" placeholder="e.g. JavaScript, Python, SQL" value={vacSkills} onChange={(e) => setVacSkills(e.target.value)} />
                    </div>
                  </div>

                  <div className="row">
                    <div className="field" style={{ flex: 1 }}>
                      <label htmlFor="vfrom">Available From</label>
                      <input id="vfrom" className="input" type="date" required value={vacFrom} onChange={(e) => setVacFrom(e.target.value)} />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label htmlFor="vto">Available Until</label>
                      <input id="vto" className="input" type="date" required min={vacFrom} value={vacTo} onChange={(e) => setVacTo(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ marginTop: '.5rem' }}>
                    <span className="small" style={{ fontWeight: 600 }}>Applicant Requirements:</span>
                    <p className="hint" style={{ margin: '.2rem 0 .5rem' }}>
                      <em>Note: An official Internship Introductory Letter from the student’s school is mandatory for all applications.</em>
                    </p>
                    <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                      <label className="row" style={{ gap: '.3rem', alignItems: 'center' }}>
                        <input type="checkbox" checked={reqCv} onChange={(e) => setReqCv(e.target.checked)} />
                        <span>Require CV / Résumé</span>
                      </label>
                      <label className="row" style={{ gap: '.3rem', alignItems: 'center' }}>
                        <input type="checkbox" checked={reqCoverNote} onChange={(e) => setReqCoverNote(e.target.checked)} />
                        <span>Require Cover Note</span>
                      </label>
                      <label className="row" style={{ gap: '.3rem', alignItems: 'center' }}>
                        <input type="checkbox" checked={reqStudentId} onChange={(e) => setReqStudentId(e.target.checked)} />
                        <span>Require Student ID Photo</span>
                      </label>
                    </div>
                  </div>

                  <div className="row" style={{ marginTop: '.5rem' }}>
                    <button className="btn btn-primary" disabled={busy}>{busy ? 'Publishing...' : 'Publish Vacancy Live'}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setActiveDeptId(null)}>Cancel</button>
                  </div>
                </form>
              )}

              {vacancies.length === 0 && activeDeptId !== dept.id && (
                <p className="muted small">No vacancies posted in this department yet. Click "+ Post Vacancy" to advertise to students.</p>
              )}

              {vacancies.map((v) => (
                <div key={v.id} className="card" style={{ marginBottom: '.5rem', padding: '.75rem 1rem' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{v.title}</strong>
                      <div className="small muted">
                        {v.slots - v.slotsFilled} of {v.slots} slot(s) remaining · Period: {fmtDate(v.availableFrom)} to {fmtDate(v.availableTo)}
                      </div>
                    </div>
                    <span className="badge ok">Live &amp; Open</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
