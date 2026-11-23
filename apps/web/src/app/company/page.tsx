import { ApplicationList } from '@/components/ApplicationList';

export const metadata = { title: 'Applications' };

export default function CompanyHome() {
  return <ApplicationList role="COMPANY" />;
}
