'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  limitType: 'documents' | 'compliance_checks' | 'assistant_messages' | 'api_calls';
  currentPlan?: string;
  currentUsage?: number;
  limit?: number;
}

const limitLabels = {
  documents: 'Documents',
  compliance_checks: 'Compliance Checks',
  assistant_messages: 'AI Assistant Messages',
  api_calls: 'API Calls',
};

const limitDescriptions = {
  documents: "You've reached the maximum number of documents for your current plan.",
  compliance_checks: "You've reached the maximum number of compliance checks for your current plan.",
  assistant_messages: "You've reached the maximum number of AI assistant messages for your current plan.",
  api_calls: "You've reached the maximum number of API calls for your current plan.",
};

export function LimitReachedModal({
  isOpen,
  onClose,
  workspaceId,
  limitType,
  currentPlan = 'Free',
  currentUsage,
  limit,
}: LimitReachedModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all sm:w-full sm:max-w-lg">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  {limitLabels[limitType]} Limit Reached
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-600">
                    {limitDescriptions[limitType]}
                  </p>
                  {currentUsage !== undefined && limit !== undefined && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm font-medium text-red-800">
                        Current usage: {currentUsage.toLocaleString()} / {limit.toLocaleString()}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        You're currently on the {currentPlan} plan
                      </p>
                    </div>
                  )}
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">
                      Upgrade to continue
                    </h4>
                    <p className="text-sm text-blue-700">
                      Upgrade your plan to get higher limits and unlock more features:
                    </p>
                    <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
                      <li>Increased {limitLabels[limitType].toLowerCase()} capacity</li>
                      <li>Priority support</li>
                      <li>Advanced compliance features</li>
                      <li>Team collaboration tools</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-3">
            <Link
              href={`/workspaces/${workspaceId}/billing/upgrade`}
              className="inline-flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto"
            >
              Upgrade Plan
            </Link>
            <Link
              href={`/workspaces/${workspaceId}/billing`}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            >
              View Usage
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
