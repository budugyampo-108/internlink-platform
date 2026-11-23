import Link from 'next/link';
import { HeroVisual } from '@/components/HeroVisual';

export default function Landing() {
  return (
    <>
      <header className="topbar" style={{ background: 'var(--night)', borderColor: 'rgba(255,255,255,.1)' }}>
        <div className="container">
          <Link href="/" className="brand" style={{ color: '#fff' }}><span className="brand-mark" aria-hidden /> InternLink</Link>
          <nav className="nav" aria-label="Primary">
            <Link href="/login" style={{ color: '#fff' }}>Sign in</Link>
            <Link href="/register" className="btn btn-primary">Create account</Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container">
            <div>
              <p className="chip" style={{ background: 'rgba(99,102,241,.25)', color: '#c7d2fe' }}>Internships &amp; industrial attachments</p>
              <h1 id="hero-title">Find your attachment where you are this vacation.</h1>
              <p className="lead">
                Students discover companies near their current location. Companies find the right skills for each
                department. One platform, one conversation, one verified evaluation.
              </p>
              <div className="row">
                <Link href="/register?role=STUDENT" className="btn btn-primary btn-lg">I’m a student</Link>
                <Link href="/register?role=COMPANY" className="btn btn-ghost btn-lg">I’m hiring</Link>
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section className="container" style={{ padding: '3rem 0' }} aria-labelledby="how">
          <h2 id="how">How it works</h2>
          <div className="features">
            <article className="card"><h3>1 · Discover nearby</h3><p className="muted">Pin your vacation location on the map and see open slots by department, distance and skills.</p></article>
            <article className="card"><h3>2 · Apply &amp; talk</h3><p className="muted">Upload your introductory letter, then chat with HR — type or dictate by voice.</p></article>
            <article className="card"><h3>3 · Get evaluated</h3><p className="muted">After your attachment, HR submits your evaluation. It is sealed: nobody can edit it afterwards.</p></article>
          </div>
        </section>
      </main>
      <footer className="container muted small" style={{ paddingBottom: '2rem' }}>© {new Date().getFullYear()} InternLink</footer>
    </>
  );
}
