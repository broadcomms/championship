'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type LimitType = 'documents' | 'compliance_checks' | 'assistant_messages' | 'api_calls';

interface LimitStatus {
  current: number;
  limit: number;
  isNearLimit: boolean; // >80%
  isAtLimit: boolean; // >=100%
  percentage: number;
}

interface UseLimitCheckResult {
  limits: Record<LimitType, LimitStatus> | null;
  loading: boolean;
  error: string | null;
  checkLimit: (type: LimitType) => LimitStatus | null;
  canPerformAction: (type: LimitType) => boolean;
  refresh: () => Promise<void>;
}

export function useLimitCheck(workspaceId: string): UseLimitCheckResult {
  const [limits, setLimits] = useState<Record<LimitType, LimitStatus> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLimits = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/workspaces/${workspaceId}/limits`);

      const limitStatus: Record<LimitType, LimitStatus> = {
        documents: calculateStatus(data.documentsUsed, data.documentsLimit),
        compliance_checks: calculateStatus(data.complianceChecksUsed, data.complianceChecksLimit),
        assistant_messages: calculateStatus(data.assistantMessagesUsed, data.assistantMessagesLimit),
        api_calls: calculateStatus(data.apiCallsUsed, data.apiCallsLimit),
      };

      setLimits(limitStatus);
      setError(null);
    } catch (err) {
      setError('Failed to load usage limits');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLimits();
  }, [workspaceId]);

  const calculateStatus = (current: number, limit: number): LimitStatus => {
    // -1 means unlimited
    if (limit === -1) {
      return {
        current,
        limit,
        isNearLimit: false,
        isAtLimit: false,
        percentage: 0,
      };
    }

    const percentage = (current / limit) * 100;

    return {
      current,
      limit,
      isNearLimit: percentage > 80,
      isAtLimit: percentage >= 100,
      percentage,
    };
  };

  const checkLimit = (type: LimitType): LimitStatus | null => {
    return limits ? limits[type] : null;
  };

  const canPerformAction = (type: LimitType): boolean => {
    if (!limits) return true; // Allow if limits haven't loaded yet
    const limit = limits[type];
    if (!limit) return true;
    if (limit.limit === -1) return true; // Unlimited
    return !limit.isAtLimit;
  };

  const refresh = async () => {
    await loadLimits();
  };

  return {
    limits,
    loading,
    error,
    checkLimit,
    canPerformAction,
    refresh,
  };
}
