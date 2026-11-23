'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loginSchema, registerSchema, type Role } from '@internlink/shared';
import { api, ApiError } from '@/lib/client';

type Mode = 'login' | 'register';
type Errors = Record<string, string>;

export function AuthForm({ mode }: { mode: Mode }) {
  const [role, setRole] = useState<Role>('STUDENT');
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('role');
    if (r === 'COMPANY' || r === 'STUDENT') setRole(r);
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function payload() {
    if (mode === 'login') return { email: values.email ?? '', password: values.password ?? '' };
    const common = { role, email: values.email ?? '', password: values.password ?? '', fullName: values.fullName ?? '' };
    return role === 'STUDENT'
      ? { ...common, institution: values.institution ?? '', program: values.program ?? '', level: Number(values.level) }
      : { ...common, jobTitle: values.jobTitle ?? '', companyName: values.companyName ?? '', industry: values.industry ?? '' };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    // Inline validation with the SAME schema the server uses.
    const parsed = (mode === 'login' ? loginSchema : registerSchema).safeParse(payload());
    if (!parsed.success) {
      const errs: Errors = {};
      parsed.error.issues.forEach((i) => { errs[String(i.path[0])] ??= i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await api<{ user: { role: Role } }>(`/api/auth/${mode}`, { method: 'POST', json: parsed.data });
      const next = new URLSearchParams(window.location.search).get('next');
      const home = res.user.role === 'STUDENT' ? '/student' : '/company';
      window.location.assign(next && next.startsWith(home) ? next : home);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields?.length) setErrors(Object.fromEntries(err.fields.map((f) => [f.path, f.message])));
        setFormError(err.message);
      } else setFormError('Network problem. Check your connection and try again.');
      setBusy(false);
    }
  }

  const Field = ({ id, label, type = 'text', hint, auto }: { id: string; label: string; type?: string; hint?: string; auto?: string }) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type={type === 'password' && showPw ? 'text' : type}
        value={values[id] ?? ''}
        onChange={set(id)}
        autoComplete={auto}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `${id}-err` : hint ? `${id}-hint` : undefined}
        inputMode={type === 'number' ? 'numeric' : undefined}
      />
      {hint && !errors[id] && <span id={`${id}-hint`} className="hint">{hint}</span>}
      {errors[id] && <span id={`${id}-err`} className="field-error" role="alert">{errors[id]}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="card" style={{ maxWidth: 520, margin: '2rem auto' }} aria-labelledby="auth-title">
      <h1 id="auth-title" style={{ fontSize: '1.75rem' }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>

      {mode === 'register' && (
        <fieldset style={{ border: 0, padding: 0, margin: '0 0 1rem' }}>
          <legend className="small muted" style={{ marginBottom: '.4rem' }}>I am a…</legend>
          <div className="row" role="radiogroup">
            {(['STUDENT', 'COMPANY'] as const).map((r) => (
              <label key={r} className="btn" style={{ flex: 1, ...(role === r ? { background: 'var(--brand-soft)', borderColor: 'var(--brand)', color: 'var(--brand)' } : {}) }}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                {r === 'STUDENT' ? 'Student' : 'Company (HR)'}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {formError && <div className="alert error" role="alert" style={{ marginBottom: '1rem' }}>{formError}</div>}

      {mode === 'register' && <Field id="fullName" label="Full name" auto="name" />}
      <Field id="email" label="Email" type="email" auto="email" />
      <div>
        <Field id="password" label="Password" type="password" auto={mode === 'login' ? 'current-password' : 'new-password'} hint={mode === 'register' ? 'At least 10 characters, with letters and numbers' : undefined} />
        <button type="button" className="btn btn-ghost" onClick={() => setShowPw((s) => !s)} aria-pressed={showPw} style={{ marginTop: '-.5rem', marginBottom: '1rem' }}>
          {showPw ? 'Hide' : 'Show'} password
        </button>
      </div>

      {mode === 'register' && role === 'STUDENT' && (
        <>
          <Field id="institution" label="Institution" />
          <Field id="program" label="Program / major" />
          <Field id="level" label="Level / year" type="number" hint="e.g. 300 or 400" />
        </>
      )}
      {mode === 'register' && role === 'COMPANY' && (
        <>
          <Field id="companyName" label="Company name" />
          <Field id="industry" label="Industry sector" />
          <Field id="jobTitle" label="Your job title" hint="e.g. HR Manager, Supervisor" />
        </>
      )}

      <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      <p className="small muted" style={{ marginTop: '1rem', textAlign: 'center' }}>
        {mode === 'login' ? <>New here? <Link href="/register">Create an account</Link></> : <>Already registered? <Link href="/login">Sign in</Link></>}
      </p>
    </form>
  );
}
