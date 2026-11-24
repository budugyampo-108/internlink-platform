import { VacancyExplorer } from '@/components/VacancyExplorer';

export const metadata = { title: 'Find Industries Near Me' };

export default function StudentHome() {
  return (
    <>
      <h1 style={{ fontSize: '1.6rem' }}>Find Industries Near Me</h1>
      <VacancyExplorer />
    </>
  );
}
