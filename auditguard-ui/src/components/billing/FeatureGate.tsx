/**
 * FeatureGate Component
 * Conditionally renders content based on feature access
 */

import React from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradeBadge } from './UpgradeBadge';
import type { FeatureId } from '@/utils/feature-gates';

interface FeatureGateProps {
  workspaceId: string | undefined;
  featureId: FeatureId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradeBadge?: boolean;
  onUpgradeClick?: () => void;
}

/**
 * Wrapper component that gates content based on feature access
 * Usage:
 * <FeatureGate workspaceId={workspaceId} featureId="advanced_analytics">
 *   <AdvancedAnalyticsPanel />
 * </FeatureGate>
 */
export function FeatureGate({
  workspaceId,
  featureId,
  children,
  fallback,
  showUpgradeBadge = true,
  onUpgradeClick,
}: FeatureGateProps) {
  const { hasAccess, loading, requiredPlan, isTrial } = useFeatureAccess(workspaceId, featureId);

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded h-20 w-full" />
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradeBadge) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 backdrop-blur-sm">
          <UpgradeBadge
            requiredPlan={requiredPlan}
            isTrial={isTrial}
            onClick={onUpgradeClick}
          />
        </div>
      </div>
    );
  }

  return null;
}
