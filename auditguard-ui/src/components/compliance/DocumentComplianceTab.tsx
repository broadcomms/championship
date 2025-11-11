'use client';

import React, { useEffect, useState } from 'react';
import {
  DocumentComplianceSummary,
  ComplianceCheck,
  ComplianceCheckStatus,
  ComplianceFramework,
} from '@/types';
import { DocumentComplianceIssuesList } from './DocumentComplianceIssuesList';

interface DocumentComplianceTabProps {
  workspaceId: string;
  documentId: string;
}

// Framework definitions with readable labels
const FRAMEWORKS: { value: ComplianceFramework; label: string; description: string }[] = [
  { value: 'GDPR', label: 'GDPR', description: 'General Data Protection Regulation (EU)' },
  { value: 'HIPAA', label: 'HIPAA', description: 'Health Insurance Portability and Accountability Act (US Healthcare)' },
  { value: 'SOC2', label: 'SOC 2', description: 'Service Organization Control 2 (Cloud Security)' },
  { value: 'PCI_DSS', label: 'PCI DSS', description: 'Payment Card Industry Data Security Standard' },
  { value: 'ISO_27001', label: 'ISO 27001', description: 'Information Security Management' },
  { value: 'NIST_CSF', label: 'NIST CSF', description: 'NIST Cybersecurity Framework' },
  { value: 'CCPA', label: 'CCPA', description: 'California Consumer Privacy Act' },
  { value: 'FERPA', label: 'FERPA', description: 'Family Educational Rights and Privacy Act' },
  { value: 'GLBA', label: 'GLBA', description: 'Gramm-Leach-Bliley Act (Financial Services)' },
  { value: 'FISMA', label: 'FISMA', description: 'Federal Information Security Management Act' },
  { value: 'PIPEDA', label: 'PIPEDA', description: 'Personal Information Protection and Electronic Documents Act (Canada)' },
  { value: 'COPPA', label: 'COPPA', description: 'Children\'s Online Privacy Protection Act' },
  { value: 'SOX', label: 'SOX', description: 'Sarbanes-Oxley Act (Financial Reporting)' },
];

const RISK_LEVEL_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_COLORS: Record<ComplianceCheckStatus, string> = {
  pending: 'bg-gray-100 text-gray-800 border-gray-300',
  running: 'bg-blue-100 text-blue-800 border-blue-300',
  processing: 'bg-blue-100 text-blue-800 border-blue-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
};

export function DocumentComplianceTab({
  workspaceId,
  documentId,
}: DocumentComplianceTabProps) {
  const [summary, setSummary] = useState<DocumentComplianceSummary | null>(null);
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [selectedCheckId, setSelectedCheckId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningCheck, setRunningCheck] = useState(false);
  
  // Framework selection state
  const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework>('GDPR');
  const [showFrameworkDropdown, setShowFrameworkDropdown] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchChecks();
  }, [workspaceId, documentId]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/documents/${documentId}/compliance/summary`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // No compliance checks have been run yet - this is not an error
          setSummary(null);
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch compliance summary');
      }

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const fetchChecks = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/documents/${documentId}/compliance/checks`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch checks');
      }

      const data = await response.json();
      setChecks(data.checks || []);
    } catch (err) {
      console.error('Failed to fetch checks:', err);
    }
  };

  const runComplianceCheck = async () => {
    setRunningCheck(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/documents/${documentId}/compliance/analyze`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ framework: selectedFramework }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start compliance check');
      }

      const data = await response.json();

      // Refresh the checks list
      await fetchChecks();

      // Set the new check as selected
      if (data.checkId) {
        setSelectedCheckId(data.checkId);
      }

      // Poll for summary with exponential backoff (max 5 attempts over ~10 seconds)
      const pollSummary = async (attempt: number = 1): Promise<void> => {
        if (attempt > 5) {
          console.warn('Max polling attempts reached for compliance summary');
          return;
        }

        const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 3000); // 1s, 1.5s, 2.25s, 3s, 3s
        await new Promise((resolve) => setTimeout(resolve, delay));

        const summaryResponse = await fetch(
          `/api/workspaces/${workspaceId}/documents/${documentId}/compliance/summary`,
          { credentials: 'include' }
        );

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setSummary(summaryData);
        } else if (summaryResponse.status === 404 && attempt < 5) {
          // Cache not ready yet, try again
          await pollSummary(attempt + 1);
        }
      };

      await pollSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run check');
    } finally {
      setRunningCheck(false);
    }
  };

  const formatScore = (score: number | null): string => {
    if (score === null) return 'N/A';
    return `${score.toFixed(1)}/100`;
  };

  const getRiskLevelColor = (riskLevel: string | null): string => {
    if (!riskLevel) return 'bg-gray-100 text-gray-800 border-gray-300';
    return RISK_LEVEL_COLORS[riskLevel.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Compliance Summary Card */}
      {loading && !summary ? (
        <div className="flex items-center justify-center py-12 bg-white border border-gray-200 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : summary ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Compliance Overview</h2>
            <div className="flex items-center gap-3">
              {/* Framework Selection Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowFrameworkDropdown(!showFrameworkDropdown)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {FRAMEWORKS.find(f => f.value === selectedFramework)?.label || 'Select Framework'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showFrameworkDropdown && (
                  <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
                    {FRAMEWORKS.map((framework) => (
                      <button
                        key={framework.value}
                        onClick={() => {
                          setSelectedFramework(framework.value);
                          setShowFrameworkDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-b-0 ${
                          selectedFramework === framework.value ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {selectedFramework === framework.value ? (
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{framework.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{framework.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                onClick={runComplianceCheck}
                disabled={runningCheck}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {runningCheck ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Running Check...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Run New Check
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Score and Risk Level */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Overall Score</p>
              <p className="text-2xl font-bold text-gray-900">{formatScore(summary.overallScore)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Risk Level</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getRiskLevelColor(summary.riskLevel)}`}>
                {summary.riskLevel ? summary.riskLevel.charAt(0).toUpperCase() + summary.riskLevel.slice(1) : 'Unknown'}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Total Issues</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalIssues}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Open Issues</p>
              <p className="text-2xl font-bold text-orange-600">{summary.openIssues}</p>
            </div>
          </div>

          {/* Issues Breakdown */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Issues by Severity</h3>
            <div className="grid grid-cols-5 gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Critical</p>
                <p className="text-lg font-semibold text-red-600">{summary.criticalIssues}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">High</p>
                <p className="text-lg font-semibold text-orange-600">{summary.highIssues}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Medium</p>
                <p className="text-lg font-semibold text-yellow-600">{summary.mediumIssues}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Low</p>
                <p className="text-lg font-semibold text-blue-600">{summary.lowIssues}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Resolved</p>
                <p className="text-lg font-semibold text-green-600">{summary.resolvedIssues}</p>
              </div>
            </div>
          </div>

          {/* Last Analyzed */}
          {summary.lastAnalyzedAt && (
            <div className="mt-4 text-xs text-gray-500">
              Last analyzed: {new Date(summary.lastAnalyzedAt).toLocaleString()}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Compliance Analysis Yet</h3>
            <p className="text-gray-600 mb-4">Select a framework and run a compliance check to analyze this document</p>
            
            {/* Framework Selection for Empty State */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative">
                <button
                  onClick={() => setShowFrameworkDropdown(!showFrameworkDropdown)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {FRAMEWORKS.find(f => f.value === selectedFramework)?.label || 'Select Framework'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showFrameworkDropdown && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
                    {FRAMEWORKS.map((framework) => (
                      <button
                        key={framework.value}
                        onClick={() => {
                          setSelectedFramework(framework.value);
                          setShowFrameworkDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-b-0 ${
                          selectedFramework === framework.value ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {selectedFramework === framework.value ? (
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{framework.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{framework.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={runComplianceCheck}
              disabled={runningCheck}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {runningCheck ? 'Running Check...' : 'Run Compliance Check'}
            </button>
          </div>
        </div>
      )}

      {/* Check History */}
      {checks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Check History</h3>
          <div className="space-y-2">
            {checks.map((check) => (
              <button
                key={check.id}
                onClick={() => setSelectedCheckId(check.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedCheckId === check.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-gray-900">{check.framework}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[check.status]}`}>
                        {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Score: {formatScore(check.overallScore)}</span>
                      <span>Issues: {check.issuesFound}</span>
                      <span>{new Date(check.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {selectedCheckId === check.id && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Issues List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Issues</h3>
        <DocumentComplianceIssuesList
          workspaceId={workspaceId}
          documentId={documentId}
          checkId={selectedCheckId}
        />
      </div>
    </div>
  );
}
