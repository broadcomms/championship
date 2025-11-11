'use client';

import { useState, useEffect } from 'react';
import { ComplianceCheck, CheckStatus } from '@/types';
import { ComplianceScoreGauge } from './ComplianceScoreGauge';
import { LiveProgressBar } from '@/components/realtime';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';

interface ComplianceCheckResultProps {
  checkId: string;
  workspaceId: string;
  documentId: string;
  onCheckComplete?: (check: ComplianceCheck) => void;
  onError?: (error: string) => void;
  pollInterval?: number; // milliseconds
  enableRealtime?: boolean; // Enable WebSocket updates
}

export function ComplianceCheckResult({
  checkId,
  workspaceId,
  documentId,
  onCheckComplete,
  onError,
  pollInterval = 2000,
  enableRealtime = true,
}: ComplianceCheckResultProps) {
  const [check, setCheck] = useState<ComplianceCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // WebSocket for real-time updates
  const { subscribe } = useWebSocket({
    workspaceId,
    onMessage: (message: WebSocketMessage) => {
      if (message.type === 'compliance_check_update' && message.data?.checkId === checkId) {
        console.log('Real-time check update:', message.data);
        
        // Update progress
        if (message.data.progress !== undefined) {
          setProgress(message.data.progress);
        }

        // Update check status
        setCheck(prev => prev ? {
          ...prev,
          status: message.data.status || prev.status,
          overallScore: message.data.score ?? prev.overallScore,
        } : null);

        // Handle completion
        if (message.data.status === 'completed' && check) {
          const completedCheck = {
            ...check,
            status: 'completed' as CheckStatus,
            overallScore: message.data.score ?? check.overallScore,
          };
          onCheckComplete?.(completedCheck);
        }

        // Handle failure
        if (message.data.status === 'failed') {
          setError('Compliance check failed');
          onError?.('Compliance check failed');
        }
      }
    },
  });

  // Subscribe to compliance-checks channel
  useEffect(() => {
    if (enableRealtime) {
      subscribe('compliance-checks');
    }
  }, [enableRealtime, subscribe]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const fetchCheckStatus = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/compliance/${checkId}`,
          {
            credentials: 'include',
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch check status');
        }

        const data = await response.json();
        
        if (isMounted) {
          setCheck(data);
          setLoading(false);

          // Stop polling if check is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            if (intervalId) {
              clearInterval(intervalId);
            }
            if (data.status === 'completed' && onCheckComplete) {
              onCheckComplete(data);
            }
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch check status';
        if (isMounted) {
          setError(errorMessage);
          setLoading(false);
          if (onError) {
            onError(errorMessage);
          }
        }
        if (intervalId) {
          clearInterval(intervalId);
        }
      }
    };

    // Initial fetch
    fetchCheckStatus();

    // Start polling
    intervalId = setInterval(fetchCheckStatus, pollInterval);

    // Cleanup
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [checkId, workspaceId, pollInterval, onCheckComplete, onError]);

  if (loading && !check) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center space-x-3">
          <svg
            className="animate-spin h-6 w-6 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-gray-700">Loading check status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-red-800">Error Loading Check</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!check) {
    return null;
  }

  const getStatusBadge = (status: CheckStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            Pending
          </span>
        );
      case 'running':
      case 'processing':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {status === 'running' ? 'Running' : 'Processing'}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <svg className="-ml-1 mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <svg className="-ml-1 mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Check Results</h3>
        {getStatusBadge(check.status)}
      </div>

      {(check.status === 'processing' || check.status === 'running' || check.status === 'pending') && (
        <div className="mb-6">
          <LiveProgressBar 
            status={check.status === 'processing' || check.status === 'running' ? 'running' : 'pending'} 
            progress={progress}
            checkId={check.id}
          />
          <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <span className="text-sm text-yellow-800">
              Analyzing document against {check.framework} requirements...
            </span>
          </div>
        </div>
      )}

      {check.status === 'completed' && (
        <>
          <div className="mb-6 flex justify-center">
            <ComplianceScoreGauge score={check.overallScore || 0} size="large" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Framework</div>
              <div className="text-lg font-semibold text-gray-900">{check.framework}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Issues Found</div>
              <div className="text-lg font-semibold text-gray-900">{check.issuesFound}</div>
            </div>
          </div>

          {check.issuesFound > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                View detailed issues and recommendations in the Issues tab below.
              </p>
            </div>
          )}
        </>
      )}

      {check.status === 'failed' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-red-800">Check Failed</h4>
              <p className="text-sm text-red-700 mt-1">
                The compliance check could not be completed. Please try running the check again.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600 space-y-1">
        <div>
          <span className="font-medium">Check ID:</span> {check.id}
        </div>
        <div>
          <span className="font-medium">Started:</span> {formatDate(check.createdAt)}
        </div>
        {check.completedAt && (
          <div>
            <span className="font-medium">Completed:</span> {formatDate(check.completedAt)}
          </div>
        )}
      </div>
    </div>
  );
}
