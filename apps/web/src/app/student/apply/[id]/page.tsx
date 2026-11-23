import { ApplyForm } from '@/components/ApplyForm';

export const metadata = { title: 'Apply' };

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplyForm vacancyId={id} />;
}
