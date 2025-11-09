'use client';

import React, { useState } from 'react';
import type { ComplianceFramework } from '@/types';

/**
 * Compliance Check Runner Component
 *
 * Allows users to initiate a compliance check on a document
 * by selecting a framework and triggering the analysis.
 *
 * Features:
 * - Framework selection dropdown
 * - Loading states
 * - Error handling
 * - Accessible form controls
 * - Responsive design
 *
 * @example
 * <ComplianceCheckRunner
 *   workspaceId="wks_123"
 *   documentId="doc_456"
 *   onCheckStarted={(checkId) => console.log(checkId)}
 * />
 */

export interface ComplianceCheckRunnerProps {
  /** Workspace ID */
  workspaceId: string;
  /** Document ID to check */
  documentId: string;
  /** Callback when check is successfully started */
  onCheckStarted?: (checkId: string) => void;
  /** Callback when there's an error */
  onError?: (error: string) => void;
  /** API base URL (optional, defaults to /api) */
  apiBaseUrl?: string;
  /** Optional class name */
  className?: string;
}

interface FrameworkOption {
  value: ComplianceFramework;
  label: string;
  description: string;
}

/**
 * Available compliance frameworks with descriptions
 */
const FRAMEWORKS: FrameworkOption[] = [
  {
    value: 'GDPR',
    label: 'GDPR',
    description: 'EU General Data Protection Regulation - Data privacy and protection',
  },
  {
    value: 'HIPAA',
    label: 'HIPAA',
    description: 'Healthcare Privacy & Security - Protected Health Information',
  },
  {
    value: 'SOC2',
    label: 'SOC 2',
    description: 'Trust Service Criteria - Security, Availability, Integrity',
  },
  {
    value: 'PCI_DSS',
    label: 'PCI DSS',
    description: 'Payment Card Security - Cardholder data protection',
  },
  {
    value: 'ISO_27001',
    label: 'ISO 27001',
    description: 'Information Security Management Systems',
  },
  {
    value: 'NIST_CSF',
    label: 'NIST CSF',
    description: 'Cybersecurity Framework - Identify, Protect, Detect, Respond, Recover',
  },
  {
    value: 'CCPA',
    label: 'CCPA',
    description: 'California Consumer Privacy Act - Consumer data rights',
  },
  {
    value: 'SOX',
    label: 'SOX',
    description: 'Sarbanes-Oxley - Financial reporting and internal controls',
  },
  {
    value: 'FERPA',
    label: 'FERPA',
    description: 'Family Educational Rights and Privacy Act',
  },
  {
    value: 'GLBA',
    label: 'GLBA',
    description: 'Gramm-Leach-Bliley Act - Financial privacy',
  },
  {
    value: 'FISMA',
    label: 'FISMA',
    description: 'Federal Information Security Management Act',
  },
  {
    value: 'PIPEDA',
    label: 'PIPEDA',
    description: 'Personal Information Protection (Canada)',
  },
  {
    value: 'COPPA',
    label: 'COPPA',
    description: "Children's Online Privacy Protection Act",
  },
];

export function ComplianceCheckRunner({
  workspaceId,
  documentId,
  onCheckStarted,
  onError,
  apiBaseUrl = '/api',
  className = '',
}: ComplianceCheckRunnerProps) {
  const [selectedFramework, setSelectedFramework] =
    useState<ComplianceFramework | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFramework) {
      setError('Please select a compliance framework');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(
        `${apiBaseUrl}/workspaces/${workspaceId}/documents/${documentId}/compliance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            framework: selectedFramework,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to start compliance check: ${response.statusText}`
        );
      }

      const data = await response.json();
      setSuccess(true);

      if (onCheckStarted && data.checkId) {
        onCheckStarted(data.checkId);
      }

      // Reset form after success
      setTimeout(() => {
        setSuccess(false);
        setSelectedFramework('');
      }, 2000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start compliance check';
      setError(errorMessage);

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Run Compliance Check
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Framework selector */}
        <div>
          <label
            htmlFor="framework-select"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Compliance Framework
          </label>
          <select
            id="framework-select"
            value={selectedFramework}
            onChange={(e) => {
              setSelectedFramework(e.target.value as ComplianceFramework);
              setError(null);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={loading}
            required
            aria-describedby="framework-description"
          >
            <option value="">Choose a compliance framework...</option>
            {FRAMEWORKS.map((fw) => (
              <option key={fw.value} value={fw.value}>
                {fw.label} - {fw.description}
              </option>
            ))}
          </select>
          {selectedFramework && (
            <p
              id="framework-description"
              className="mt-2 text-sm text-gray-500"
            >
              {FRAMEWORKS.find((f) => f.value === selectedFramework)?.description}
            </p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div
            className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-2">
              <svg
                className="h-5 w-5 text-red-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div
            className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              <svg
                className="h-5 w-5 text-green-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Compliance check started successfully!</span>
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!selectedFramework || loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
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
              <span>Starting Check...</span>
            </span>
          ) : (
            'Run Compliance Check'
          )}
        </button>
      </form>

      {/* Info message */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Note:</span> The compliance check will analyze this
          document against the selected framework and identify any issues or gaps.
        </p>
      </div>
    </div>
  );
}

export default ComplianceCheckRunner;
