'use client';

import { WorkspaceLimits } from '@/types';

interface UsageMetricsProps {
  limits: WorkspaceLimits;
}

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number;
  unit?: string;
}

function UsageMeter({ label, current, limit, unit = '' }: UsageMeterProps) {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isNearLimit = percentage > 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-600">
          {limit === -1 ? (
            <span className="text-green-600 font-semibold">Unlimited</span>
          ) : (
            <>
              {current.toLocaleString()} / {limit.toLocaleString()} {unit}
            </>
          )}
        </span>
      </div>

      {limit !== -1 && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                isAtLimit
                  ? 'bg-red-500'
                  : isNearLimit
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className={isNearLimit ? 'text-yellow-600 font-medium' : 'text-gray-500'}>
              {percentage.toFixed(1)}% used
            </span>
            {isAtLimit && (
              <span className="text-red-600 font-semibold">Limit reached!</span>
            )}
            {isNearLimit && !isAtLimit && (
              <span className="text-yellow-600 font-medium">Approaching limit</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function UsageMetrics({ limits }: UsageMetricsProps) {
  const metrics = [
    {
      label: 'Documents',
      current: limits.documentsUsed,
      limit: limits.documentsLimit,
    },
    {
      label: 'Compliance Checks',
      current: limits.complianceChecksUsed,
      limit: limits.complianceChecksLimit,
    },
    {
      label: 'AI Assistant Messages',
      current: limits.assistantMessagesUsed,
      limit: limits.assistantMessagesLimit,
    },
    {
      label: 'API Calls',
      current: limits.apiCallsUsed,
      limit: limits.apiCallsLimit,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h3>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <UsageMeter
              key={metric.label}
              label={metric.label}
              current={metric.current}
              limit={metric.limit}
            />
          ))}
        </div>
      </div>

      {/* Warning Banner */}
      {metrics.some((m) => m.limit > 0 && m.current >= m.limit) && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Usage Limit Reached
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  You've reached your plan's limit for one or more resources. Upgrade your plan to continue using these features.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approaching Limit Warning */}
      {metrics.some((m) => m.limit > 0 && m.current / m.limit > 0.8 && m.current < m.limit) && (
        <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Approaching Usage Limit
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  You're approaching your plan's limits. Consider upgrading to avoid service interruptions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
