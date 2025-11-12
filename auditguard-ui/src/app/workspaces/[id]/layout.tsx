'use client';

import { AIChatWidget } from '@/components/assistant/AIChatWidget';
import { useParams } from 'next/navigation';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const workspaceId = params.id as string;

  return (
    <>
      {children}
      {/* AI Assistant Chat Widget - available on all workspace pages */}
      {workspaceId && <AIChatWidget workspaceId={workspaceId} />}
    </>
  );
}
