import { AppShell } from '@/components/AppShell';

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="COMPANY">{children}</AppShell>;
}
