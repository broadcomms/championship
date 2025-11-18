'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';

type CheckStep = 'select_framework' | 'select_documents' | 'configure' | 'running' | 'complete';

interface Document {
  id: string;
  filename: string;
  title: string | null;
  fileSize: number;
  contentType: string;
  processingStatus: string;
  uploadedAt: number;
}

interface CheckConfig {
  framework: string;
  document_ids: string[];
  auto_assign_issues: boolean;
  notify_on_complete: boolean;
  severity_threshold: 'all' | 'medium' | 'high' | 'critical';
}

interface ComplianceCheckResult {
  batchId: string;
  status: string;
  total: number;
  completed: number;
  processing: number;
  failed: number;
  checks: Array<{
    checkId: string;
    documentId: string;
    documentName: string;
    status: string;
    overallScore: number | null;
    issuesFound: number;
    createdAt: number;
    completedAt: number | null;
  }>;
}

interface UsageLimits {
  checks_used: number;
  checks_limit: number;
  subscription_tier: string;
}

export default function RunComplianceCheckPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const { user } = useAuth();
  const accountId = user?.userId;

  const [currentStep, setCurrentStep] = useState<CheckStep>('select_framework');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [config, setConfig] = useState<CheckConfig>({
    framework: '',
    document_ids: [],
    auto_assign_issues: true,
    notify_on_complete: true,
    severity_threshold: 'all',
  });
  const [checkResult, setCheckResult] = useState<ComplianceCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [loadingLimits, setLoadingLimits] = useState(true);

  // Fetch usage limits on mount
  useEffect(() => {
    const fetchUsageLimits = async () => {
      try {
        const data = await api.get(`/api/organizations/${orgId}/usage/forecast`);
        if (data && data.plan_limits && data.current_usage) {
          setUsageLimits({
            checks_used: data.current_usage.checks || 0,
            checks_limit: data.plan_limits.max_checks || 5,
            subscription_tier: data.plan_limits.tier || 'Free',
          });
        }
      } catch (error) {
        console.error('Failed to fetch usage limits:', error);
        // Set defaults if fetch fails
        setUsageLimits({
          checks_used: 0,
          checks_limit: 5,
          subscription_tier: 'Free',
        });
      } finally {
        setLoadingLimits(false);
      }
    };

    fetchUsageLimits();
  }, [orgId]);

  const frameworks = [
    {
      id: 'SOC2',
      name: 'SOC 2',
      description: 'Trust Service Criteria for security, availability, processing integrity, confidentiality, and privacy',
      icon: '🔒',
      controls: 64,
    },
    {
      id: 'ISO27001',
      name: 'ISO 27001',
      description: 'International standard for information security management systems',
      icon: '🌐',
      controls: 114,
    },
    {
      id: 'HIPAA',
      name: 'HIPAA',
      description: 'Health Insurance Portability and Accountability Act requirements',
      icon: '🏥',
      controls: 45,
    },
    {
      id: 'GDPR',
      name: 'GDPR',
      description: 'EU General Data Protection Regulation compliance',
      icon: '🇪🇺',
      controls: 37,
    },
    {
      id: 'PCIDSS',
      name: 'PCI DSS',
      description: 'Payment Card Industry Data Security Standard',
      icon: '💳',
      controls: 78,
    },
    {
      id: 'NIST',
      name: 'NIST CSF',
      description: 'NIST Cybersecurity Framework',
      icon: '🛡️',
      controls: 108,
    },
  ];

  useEffect(() => {
    if (currentStep === 'select_documents') {
      fetchDocuments();
    }
  }, [currentStep, wsId]);

  const fetchDocuments = async () => {
    try {
      const response = await api.get(`/api/workspaces/${wsId}/documents`);
      // Filter to only show completed documents
      const completedDocs = response.documents.filter((doc: Document) => doc.processingStatus === 'completed');
      setDocuments(completedDocs);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setError('Failed to load documents. Please try again.');
    }
  };

  const handleFrameworkSelect = (frameworkId: string) => {
    setConfig((prev) => ({ ...prev, framework: frameworkId }));
  };

  const handleDocumentToggle = (docId: string) => {
    setConfig((prev) => ({
      ...prev,
      document_ids: prev.document_ids.includes(docId)
        ? prev.document_ids.filter((id) => id !== docId)
        : [...prev.document_ids, docId],
    }));
  };

  // Calculate usage after this check
  const calculateUsageAfterCheck = () => {
    if (!usageLimits) return { used: 0, limit: 5, remaining: 5, willExceed: false, percentage: 0 };

    // Each compliance check run counts as 1 check credit
    const futureUsed = usageLimits.checks_used + 1;
    const remaining = Math.max(0, usageLimits.checks_limit - futureUsed);
    const willExceed = futureUsed > usageLimits.checks_limit;
    const percentage = Math.min(100, (futureUsed / usageLimits.checks_limit) * 100);

    return {
      used: futureUsed,
      limit: usageLimits.checks_limit,
      remaining,
      willExceed,
      percentage,
    };
  };

  // Render billing warning banner
  const renderBillingWarning = () => {
    if (!usageLimits || !config.framework) return null;

    const usage = calculateUsageAfterCheck();

    if (usage.willExceed) {
      return (
        <div className="mb-6 rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Check Limit Exceeded</h3>
              <p className="text-sm text-red-800 mb-2">
                This compliance check would use {usage.used} of your {usage.limit} monthly check credits.
                You need to upgrade your plan to run this compliance check.
              </p>
              <p className="text-xs text-red-700">
                Current usage: {usageLimits.checks_used}/{usageLimits.checks_limit} checks ({usageLimits.subscription_tier} plan)
              </p>
              <button
                onClick={() => router.push(`/org/${orgId}/billing`)}
                className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (usage.percentage > 80) {
      return (
        <div className="mb-6 rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-1">Approaching Check Limit</h3>
              <p className="text-sm text-yellow-800 mb-2">
                After this check, you'll have used {usage.used} of {usage.limit} monthly checks ({Math.round(usage.percentage)}%).
                Only {usage.remaining} check(s) remaining.
              </p>
              <p className="text-xs text-yellow-700">
                Consider upgrading to avoid interruptions in your compliance workflow.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">Compliance Check Credit</h3>
            <p className="text-sm text-blue-800">
              This check will use 1 of your {usage.remaining} remaining check credits.
              After check: {usage.used}/{usage.limit} used ({Math.round(usage.percentage)}%)
            </p>
          </div>
        </div>
      </div>
    );
  };

  const handleRunCheck = async () => {
    if (!config.framework || config.document_ids.length === 0) {
      setError('Please select a framework and at least one document');
      return;
    }

    setCurrentStep('running');
    setError(null);

    try {
      // Call the batch compliance check endpoint
      const response = await api.post(`/api/workspaces/${wsId}/compliance/batch`, {
        framework: config.framework,
        documentIds: config.document_ids, // Backend expects camelCase
      });

      setCheckResult(response);

      // Poll for completion using batch status endpoint
      const batchId = response.batchId;
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await api.get(`/api/workspaces/${wsId}/compliance/batch/${batchId}`);

          // Check if all checks in the batch are completed
          if (statusResponse.completed + statusResponse.failed >= statusResponse.total) {
            clearInterval(pollInterval);
            setCheckResult(statusResponse);
            setCurrentStep('complete');
          }
        } catch (error) {
          console.error('Failed to poll check status:', error);
        }
      }, 3000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);
    } catch (error: any) {
      console.error('Failed to run compliance check:', error);
      setError(error.response?.data?.message || 'Failed to run compliance check. Please try again.');
      setCurrentStep('configure');
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 'select_framework', label: 'Framework', icon: '📋' },
      { id: 'select_documents', label: 'Documents', icon: '📄' },
      { id: 'configure', label: 'Configure', icon: '⚙️' },
      { id: 'running', label: 'Running', icon: '⚡' },
      { id: 'complete', label: 'Results', icon: '✓' },
    ];

    const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                index <= currentStepIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              <span>{step.icon}</span>
              <span className="font-medium text-sm">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 ${
                  index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderFrameworkStep = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Compliance Framework</h2>
        <p className="text-gray-600">
          Choose the framework you want to check your documents against
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {frameworks.map((framework) => (
          <button
            key={framework.id}
            onClick={() => handleFrameworkSelect(framework.id)}
            className={`text-left p-6 rounded-lg border-2 transition ${
              config.framework === framework.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-4xl">{framework.icon}</span>
              {config.framework === framework.id && (
                <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold">
                  Selected
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {framework.name}
            </h3>
            <p className="text-sm text-gray-600 mb-3">{framework.description}</p>
            <div className="text-xs text-gray-500">
              {framework.controls} controls to check
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 mt-8">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          onClick={() => setCurrentStep('select_documents')}
          disabled={!config.framework}
        >
          Continue →
        </Button>
      </div>
    </div>
  );

  const renderDocumentsStep = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Documents</h2>
        <p className="text-gray-600">
          Choose the documents you want to check for compliance
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No documents available
          </h3>
          <p className="text-gray-600 mb-6">
            You need to upload documents before running compliance checks
          </p>
          <Button
            onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/documents/upload`)}
          >
            Upload Documents
          </Button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200 mb-4">
            {documents.map((doc) => (
              <label
                key={doc.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={config.document_ids.includes(doc.id)}
                  onChange={() => handleDocumentToggle(doc.id)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{doc.title || doc.filename}</div>
                  <div className="text-sm text-gray-500">
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-2xl">📄</span>
              </label>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <p className="text-sm text-blue-900">
              {config.document_ids.length} document(s) selected
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setCurrentStep('select_framework')}>
              ← Back
            </Button>
            <Button
              onClick={() => setCurrentStep('configure')}
              disabled={config.document_ids.length === 0}
            >
              Continue →
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const renderConfigureStep = () => {
    const selectedFramework = frameworks.find((f) => f.id === config.framework);
    const usage = calculateUsageAfterCheck();

    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Check</h2>
          <p className="text-gray-600">
            Customize how the compliance check should run
          </p>
        </div>

        {/* Billing Warning */}
        {renderBillingWarning()}

        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6">
          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Check Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Framework:</span>
                <span className="font-medium text-gray-900">{selectedFramework?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Documents:</span>
                <span className="font-medium text-gray-900">
                  {config.document_ids.length} selected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Controls:</span>
                <span className="font-medium text-gray-900">
                  {selectedFramework?.controls} to check
                </span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Options</h3>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.auto_assign_issues}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, auto_assign_issues: e.target.checked }))
                  }
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Auto-assign issues</div>
                  <div className="text-sm text-gray-600">
                    Automatically assign issues to workspace members based on roles
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notify_on_complete}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, notify_on_complete: e.target.checked }))
                  }
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Notify on completion</div>
                  <div className="text-sm text-gray-600">
                    Send email notification when the compliance check is complete
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Severity Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Severity to Report
            </label>
            <select
              value={config.severity_threshold}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  severity_threshold: e.target.value as any,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All issues</option>
              <option value="medium">Medium and above</option>
              <option value="high">High and above</option>
              <option value="critical">Critical only</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Only issues at or above this severity will be created
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-8">
          <Button variant="outline" onClick={() => setCurrentStep('select_documents')}>
            ← Back
          </Button>
          <Button
            onClick={handleRunCheck}
            disabled={usage.willExceed}
          >
            Run Compliance Check
          </Button>
        </div>
      </div>
    );
  };

  const renderRunningStep = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="text-6xl mb-6 animate-pulse">⚡</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Running Compliance Check</h2>
      <p className="text-gray-600 mb-8">
        Analyzing documents against {frameworks.find((f) => f.id === config.framework)?.name}...
      </p>

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              ✓
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Documents loaded</div>
              <div className="text-sm text-gray-600">
                {config.document_ids.length} document(s) ready
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-left">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center">
              <div className="animate-spin">⚙️</div>
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Analyzing compliance...</div>
              <div className="text-sm text-gray-600">
                Checking against {frameworks.find((f) => f.id === config.framework)?.controls}{' '}
                controls
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-left opacity-50">
            <div className="w-8 h-8 bg-gray-300 text-white rounded-full flex items-center justify-center text-sm">
              3
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Generating issues</div>
              <div className="text-sm text-gray-600">Creating actionable items</div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          This may take a few minutes depending on document size...
        </div>
      </div>
    </div>
  );

  const renderCompleteStep = () => {
    // Calculate aggregate stats from batch results
    const completedChecks = checkResult?.checks?.filter((c: any) => c.status === 'completed') || [];
    const totalIssues = completedChecks.reduce((sum: number, check: any) => sum + (check.issuesFound || 0), 0);
    const avgScore = completedChecks.length > 0
      ? Math.round(completedChecks.reduce((sum: number, check: any) => sum + (check.overallScore || 0), 0) / completedChecks.length)
      : 0;

    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="text-6xl mb-6">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Complete!</h2>
        <p className="text-gray-600 mb-8">
          Your compliance check has finished successfully
        </p>

        {checkResult && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
            <div className="mb-6">
              <div
                className={`text-5xl font-bold mb-2 ${
                  avgScore >= 80
                    ? 'text-green-600'
                    : avgScore >= 60
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {avgScore}%
              </div>
              <div className="text-gray-600">Average Compliance Score</div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {totalIssues}
                </div>
                <div className="text-gray-600">Total Issues</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {checkResult.total || config.document_ids.length}
                </div>
                <div className="text-gray-600">Documents Checked</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-900">
                  {checkResult.completed || completedChecks.length}
                </div>
                <div className="text-gray-600">Completed</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
          <ul className="text-sm text-blue-800 space-y-2 text-left">
            <li>• Review the detailed compliance reports for each document</li>
            <li>• Address any critical or high-severity issues</li>
            <li>• Assign issues to team members for resolution</li>
            <li>• Track progress on the Issues Kanban board</li>
          </ul>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance`)}
          >
            View All Checks
          </Button>
          <Button
            onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance`)}
          >
            View Results
          </Button>
        </div>
      </div>
    );
  };

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Run Compliance Check</h1>
            <p className="text-gray-600">
              Check your documents against compliance framework requirements
            </p>
          </div>

          {/* Step Indicator */}
          {renderStepIndicator()}

          {/* Step Content */}
          {currentStep === 'select_framework' && renderFrameworkStep()}
          {currentStep === 'select_documents' && renderDocumentsStep()}
          {currentStep === 'configure' && renderConfigureStep()}
          {currentStep === 'running' && renderRunningStep()}
          {currentStep === 'complete' && renderCompleteStep()}
      </div>
    </OrganizationLayout>
  );
}
