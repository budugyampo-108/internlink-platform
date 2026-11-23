import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <main id="main" className="container">
      <p style={{ paddingTop: '1.5rem' }}><Link href="/" className="brand"><span className="brand-mark" aria-hidden /> InternLink</Link></p>
      <AuthForm mode="register" />
    </main>
  );
}
