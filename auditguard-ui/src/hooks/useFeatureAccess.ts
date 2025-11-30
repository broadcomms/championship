/**
 * React Hook for Feature Gating
 * Client-side feature access control
 */

import { useState, useEffect } from 'react';
import { getRequiredPlan, FEATURE_METADATA, type FeatureId, type PlanId } from '../utils/feature-gates';

interface UseFeatureAccessResult {
  hasAccess: boolean;
  loading: boolean;
  planId: PlanId;
  status: string;
  requiredPlan: PlanId;
  isTrial: boolean;
  trialEnd?: number;
  upgradeMessage: string;
}

/**
 * Hook to check if current workspace has access to a feature
 */
export function useFeatureAccess(
  workspaceId: string | undefined,
  featureId: FeatureId
): UseFeatureAccessResult {
  const [result, setResult] = useState<UseFeatureAccessResult>({
    hasAccess: false,
    loading: true,
    planId: 'plan_free' as PlanId,
    status: 'none',
    requiredPlan: getRequiredPlan(featureId),
    isTrial: false,
    upgradeMessage: '',
  });

  useEffect(() => {
    if (!workspaceId) {
      setResult((prev) => ({ ...prev, loading: false }));
      return;
    }

    let mounted = true;

    async function checkAccess() {
      try {
        const response = await fetch('/api/feature-gate/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: workspaceId,
            feature_id: featureId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to check feature access');
        }

        const data = await response.json();

        if (mounted) {
          const feature = FEATURE_METADATA[featureId];
          const planNames: Record<PlanId, string> = {
            plan_free: 'Free',
            plan_starter: 'Starter',
            plan_professional: 'Professional',
            plan_business: 'Business',
            plan_enterprise: 'Enterprise',
          };

          const requiredPlan = (data.required_plan || getRequiredPlan(featureId)) as PlanId;

          setResult({
            hasAccess: data.has_access,
            loading: false,
            planId: data.plan_id,
            status: data.status,
            requiredPlan,
            isTrial: data.status === 'trialing',
            trialEnd: data.trial_end,
            upgradeMessage: data.has_access
              ? ''
              : `${feature.name} requires ${planNames[requiredPlan]} plan or higher.`,
          });
        }
      } catch (error) {
        console.error('Error checking feature access:', error);
        if (mounted) {
          setResult((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [workspaceId, featureId]);

  return result;
}

/**
 * Hook to get all features available to current workspace
 */
export function useWorkspaceFeatures(workspaceId: string | undefined) {
  const [features, setFeatures] = useState<FeatureId[]>([]);
  const [planId, setPlanId] = useState<PlanId>('plan_free');
  const [status, setStatus] = useState<string>('none');
  const [isTrial, setIsTrial] = useState(false);
  const [trialEnd, setTrialEnd] = useState<number>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchFeatures() {
      try {
        const response = await fetch('/api/feature-gate/features', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch workspace features');
        }

        const data = await response.json();

        if (mounted) {
          setFeatures(data.features);
          setPlanId(data.plan_id);
          setStatus(data.status);
          setIsTrial(data.is_trial);
          setTrialEnd(data.trial_end);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching workspace features:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchFeatures();

    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  return {
    features,
    planId,
    status,
    isTrial,
    trialEnd,
    loading,
    hasFeature: (featureId: FeatureId) => features.includes(featureId),
  };
}
