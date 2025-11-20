'use client';

import { useParams } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { useAuth } from '@/contexts/AuthContext';
import { AIAssistantPage } from '@/components/assistant/AIAssistantPage';

export default function WorkspaceAssistantPage() {
  const params = useParams();
  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const { user } = useAuth();
  const accountId = user?.userId;

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <AIAssistantPage
        workspaceId={wsId}
        userId={accountId || ''}
      />
    </OrganizationLayout>
  );
}
