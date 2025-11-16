'use client';

import { AIChatWidget } from '@/components/assistant/AIChatWidget';
import { TrialBanner } from '@/components/billing/TrialBanner';
import { useParams } from 'next/navigation';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const workspaceId = params.id as string;

  return (
    <div className="flex flex-col h-full">
      {/* PHASE 3: Trial Banner - shows countdown for Professional trial */}
      {workspaceId && (
        <div className="sticky top-0 z-40 px-4 pt-4">
          <TrialBanner workspaceId={workspaceId} />
        </div>
      )}
      
      {/* Main content */}
      <div className="flex-1">
        {children}
      </div>
      
      {/* AI Assistant Chat Widget - available on all workspace pages */}
      {workspaceId && <AIChatWidget workspaceId={workspaceId} />}
    </div>
  );
}
