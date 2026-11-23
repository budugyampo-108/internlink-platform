import { ApplicationWorkspace } from '@/components/ApplicationWorkspace';

export default async function StudentApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationWorkspace applicationId={id} role="STUDENT" />;
}
