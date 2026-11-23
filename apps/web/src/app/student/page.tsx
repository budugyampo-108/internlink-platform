import { VacancyExplorer } from '@/components/VacancyExplorer';

export const metadata = { title: 'Discover nearby' };

export default function StudentHome() {
  return (
    <>
      <h1 style={{ fontSize: '1.6rem' }}>Find an attachment near you</h1>
      <VacancyExplorer />
    </>
  );
}
