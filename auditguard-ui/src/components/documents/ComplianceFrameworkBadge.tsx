'use client';

import { useState, useEffect } from 'react';
import { ComplianceFrameworkInfo } from '@/types';
import { cn } from '@/lib/utils';

interface ComplianceFrameworkBadgeProps {
  frameworkId: number | null | undefined;
  workspaceId: string;
  className?: string;
}

const frameworkColorMap: Record<string, string> = {
  sox: 'bg-red-100 text-red-800',
  gdpr: 'bg-blue-100 text-blue-800',
  hipaa: 'bg-green-100 text-green-800',
  pci_dss: 'bg-orange-100 text-orange-800',
  iso27001: 'bg-purple-100 text-purple-800',
  nist: 'bg-indigo-100 text-indigo-800',
};

export function ComplianceFrameworkBadge({ 
  frameworkId, 
  workspaceId, 
  className 
}: ComplianceFrameworkBadgeProps) {
  const [framework, setFramework] = useState<ComplianceFrameworkInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!frameworkId) {
      setFramework(null);
      return;
    }

    const fetchFramework = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/compliance-frameworks/${frameworkId}`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          setFramework(data.framework);
        }
      } catch (error) {
        console.error('Failed to fetch compliance framework:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFramework();
  }, [frameworkId, workspaceId]);

  if (!frameworkId) {
    return null; // Don't show badge if no framework
  }

  if (loading) {
    return (
      <span className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 animate-pulse',
        className
      )}>
        Loading...
      </span>
    );
  }

  if (!framework) {
    return null; // Failed to load, don't show badge
  }

  const colorClass = frameworkColorMap[framework.name] || 'bg-gray-100 text-gray-800';

  return (
    <span 
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        colorClass,
        className
      )}
      title={framework.description}
    >
      {framework.displayName}
    </span>
  );
}
