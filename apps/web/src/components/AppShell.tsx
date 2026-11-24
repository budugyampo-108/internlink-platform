'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/client';

export function AppShell({ role, children }: { role: 'STUDENT' | 'COMPANY'; children: React.ReactNode }) {
  const path = usePathname();
  const links =
    role === 'STUDENT'
      ? [{ href: '/student', label: 'Discover nearby' }, { href: '/student/applications', label: 'My applications' }]
      : [
          { href: '/company', label: 'Applications' },
          { href: '/company/vacancies', label: 'Departments & Vacancies' },
          { href: '/company/profile', label: 'Company Profile' },
        ];

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/login');
  }

  return (
    <>
      <header className="topbar">
        <div className="container">
          <Link href="/" className="brand"><span className="brand-mark" aria-hidden /> InternLink</Link>
          <nav className="nav" aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined}>{l.label}</Link>
            ))}
            <button onClick={logout}>Sign out</button>
          </nav>
        </div>
      </header>
      <main id="main" className="page container">{children}</main>
    </>
  );
}
