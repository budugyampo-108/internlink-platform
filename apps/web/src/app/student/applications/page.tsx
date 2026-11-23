import { ApplicationList } from '@/components/ApplicationList';

export const metadata = { title: 'My applications' };

export default function StudentApplications() {
  return <ApplicationList role="STUDENT" />;
}
