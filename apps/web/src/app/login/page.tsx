import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main id="main" className="container">
      <p style={{ paddingTop: '1.5rem' }}><Link href="/" className="brand"><span className="brand-mark" aria-hidden /> InternLink</Link></p>
      <AuthForm mode="login" />
    </main>
  );
}
