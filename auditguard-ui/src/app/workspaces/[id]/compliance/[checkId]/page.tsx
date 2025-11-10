'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ComplianceCheckResult } from '@/components/compliance';

/**
 * Compliance Check Detail Page
 *
 * Displays detailed results for a specific compliance check.
 *
 * Route: /workspaces/[id]/compliance/[checkId]
 */

interface PageProps {
  params: {
    id: string;
    checkId: string;
  };
}

export default function ComplianceCheckDetailPage(props: PageProps) {
  const { id: workspaceId, checkId } = props.params;
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header with navigation */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/workspaces/${workspaceId}/compliance`)}
            className="p-2 rounded-md hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Back to compliance dashboard"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compliance Check Results</h1>
            <p className="text-sm text-gray-500 mt-1">
              View detailed analysis and identified issues
            </p>
          </div>
        </div>

        {/* Main content */}
        <ComplianceCheckResult workspaceId={workspaceId} checkId={checkId} />

        {/* Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                // Export functionality - to be implemented
                alert('Export functionality coming soon!');
              }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Export Report
              </span>
            </button>
            <button
              onClick={() => {
                // Share functionality - to be implemented
                alert('Share functionality coming soon!');
              }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Share
              </span>
            </button>
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}/compliance`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Run Another Check
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
