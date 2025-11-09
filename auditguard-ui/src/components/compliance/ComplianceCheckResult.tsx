'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ComplianceCheck, ComplianceIssue } from '@/types';
import { ComplianceScoreGauge } from './ComplianceScoreGauge';
import { IssuesList } from './IssuesList';

/**
 * Compliance Check Result Component
 *
 * Displays the results of a compliance check with real-time status updates.
 *
 * Features:
 * - Real-time polling for check status
 * - Loading and processing states
 * - Score visualization
 * - Issues display
 * - Error handling
 * - Responsive design
 *
 * @example
 * <ComplianceCheckResult
 *   workspaceId="wks_123"
 *   checkId="chk_456"
 * />
 */

export interface ComplianceCheckResultProps {
  /** Workspace ID */
  workspaceId: string;
  /** Compliance check ID */
  checkId: string;
  /** API base URL (optional, defaults to /api) */
  apiBaseUrl?: string;
  /** Polling interval in milliseconds (default: 3000) */
  pollingInterval?: number;
  /** Optional class name */
  className?: string;
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    processing: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };

  const icons: Record<string, string> = {
    processing: '⏳',
    completed: '✓',
    failed: '✗',
    pending: '⏱',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'
      }`}
      role="status"
      aria-label={`Status: ${status}`}
    >
      <span aria-hidden="true">{icons[status] || '•'}</span>
      <span>{status.toUpperCase()}</span>
    </span>
  );
}

export function ComplianceCheckResult({
  workspaceId,
  checkId,
  apiBaseUrl = '/api',
  pollingInterval = 3000,
  className = '',
}: ComplianceCheckResultProps) {
  const [check, setCheck] = useState<ComplianceCheck | null>(null);
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);

  // Fetch check status
  const fetchCheckStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/workspaces/${workspaceId}/compliance/${checkId}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch check status: ${response.statusText}`);
      }

      const checkData = await response.json();
      setCheck(checkData);

      // If completed, fetch issues and stop polling
      if (checkData.status === 'completed') {
        await fetchIssues();
        setPolling(false);
      } else if (checkData.status === 'failed') {
        setPolling(false);
        setError('Compliance check failed. Please try again.');
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching check status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load check status');
      setLoading(false);
      setPolling(false);
    }
  }, [apiBaseUrl, workspaceId, checkId]);

  // Fetch issues
  const fetchIssues = async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/workspaces/${workspaceId}/compliance/${checkId}/issues`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch issues: ${response.statusText}`);
      }

      const data = await response.json();
      setIssues(data.issues || []);
    } catch (err) {
      console.error('Error fetching issues:', err);
      // Don't set error state here, as check data is still valid
    }
  };

  // Set up polling
  useEffect(() => {
    fetchCheckStatus();

    let interval: NodeJS.Timeout | null = null;

    if (polling) {
      interval = setInterval(() => {
        fetchCheckStatus();
      }, pollingInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchCheckStatus, polling, pollingInterval]);

  // Loading state
  if (loading && !check) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-8 ${className}`}>
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading compliance check...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !check) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-8 text-center ${className}`}>
        <div className="text-red-400 mb-4">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-red-800 font-medium">Error Loading Check</p>
        <p className="text-sm text-red-600 mt-2">{error}</p>
      </div>
    );
  }

  // No check found
  if (!check) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-8 text-center ${className}`}>
        <p className="text-gray-500">Compliance check not found</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Status Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {check.framework} Compliance Check
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Started {new Date(check.createdAt).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={check.status} />
        </div>

        {/* Processing state */}
        {check.status === 'processing' && (
          <div className="mt-4" role="status" aria-live="polite">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
            <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
              Analyzing document for compliance...
            </p>
          </div>
        )}

        {/* Completed state */}
        {check.status === 'completed' && (
          <div className="mt-6">
            <div className="flex justify-center mb-6">
              <ComplianceScoreGauge score={check.overallScore || 0} size="medium" />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {check.issuesFound}
                </div>
                <div className="text-sm text-gray-500 mt-1">Issues Found</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {check.overallScore || 0}
                </div>
                <div className="text-sm text-gray-500 mt-1">Compliance Score</div>
              </div>
            </div>

            {check.completedAt && (
              <p className="text-xs text-gray-400 mt-4 text-center">
                Completed {new Date(check.completedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Failed state */}
        {check.status === 'failed' && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">
              Compliance check failed. Please try running the check again or contact support
              if the issue persists.
            </p>
          </div>
        )}
      </div>

      {/* Issues List */}
      {check.status === 'completed' && issues.length > 0 && (
        <IssuesList issues={issues} workspaceId={workspaceId} />
      )}

      {/* No issues found */}
      {check.status === 'completed' && issues.length === 0 && check.issuesFound === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
          <div className="text-green-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-green-800 font-medium">No Issues Found!</p>
          <p className="text-sm text-green-600 mt-2">
            This document appears to be fully compliant with {check.framework} requirements.
          </p>
        </div>
      )}
    </div>
  );
}

export default ComplianceCheckResult;
