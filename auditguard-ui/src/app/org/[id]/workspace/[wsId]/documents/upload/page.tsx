'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ErrorResponse } from '@/types';

type UploadStep = 'select' | 'metadata' | 'uploading' | 'complete';

interface UploadedFile {
  file: File;
  preview?: string;
}

interface UploadMetadata {
  tags: string[];
  description: string;
  framework?: string;
  runComplianceCheck?: boolean;
}

interface UsageLimits {
  uploads_used: number;
  uploads_limit: number;
  subscription_tier: string;
}

interface UsageForecastResponse {
  current_usage?: {
    documents?: number;
  } | null;
  plan_limits?: {
    max_documents?: number;
    tier?: string;
  } | null;
}

interface UploadedDocumentSummary {
  id?: string;
  filename: string;
  processingStatus?: string;
}

const getApiErrorMessage = (error: unknown): string => {
  if (
    error &&
    typeof error === 'object' &&
    'error' in error &&
    typeof (error as ErrorResponse).error === 'string'
  ) {
    return (error as ErrorResponse).error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};

export default function DocumentUploadPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const wsId = params.wsId as string;
  const accountId = user?.userId;

  const [currentStep, setCurrentStep] = useState<UploadStep>('select');
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const [metadata, setMetadata] = useState<UploadMetadata>({
    tags: [],
    description: '',
    framework: undefined,
    runComplianceCheck: false,
  });
  const [tagInput, setTagInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocumentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);

  // Fetch usage limits on mount
  useEffect(() => {
    const fetchUsageLimits = async () => {
      try {
        const data = await api.get<UsageForecastResponse>(`/api/organizations/${orgId}/usage/forecast`);
        if (data && data.plan_limits && data.current_usage) {
          setUsageLimits({
            uploads_used: data.current_usage.documents || 0,
            uploads_limit: data.plan_limits.max_documents || 10,
            subscription_tier: data.plan_limits.tier || 'Free',
          });
        }
      } catch (error) {
        console.error('Failed to fetch usage limits:', error);
        // Set defaults if fetch fails
        setUsageLimits({
          uploads_used: 0,
          uploads_limit: 10,
          subscription_tier: 'Free',
        });
      }
    };

    fetchUsageLimits();
  }, [orgId]);

  const frameworks = [
    { value: 'auto', label: 'Auto-detect (Recommended)' },
    { value: 'SOC2', label: 'SOC 2' },
    { value: 'ISO_27001', label: 'ISO 27001' },
    { value: 'HIPAA', label: 'HIPAA' },
    { value: 'GDPR', label: 'GDPR' },
    { value: 'PCI_DSS', label: 'PCI DSS' },
    { value: 'NIST_CSF', label: 'NIST CSF' },
    { value: 'FISMA', label: 'FISMA' },
    { value: 'FedRAMP', label: 'FedRAMP' },
  ];

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = files.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const newFiles: UploadedFile[] = files.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setError(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const addTag = () => {
    if (tagInput.trim() && !metadata.tags.includes(tagInput.trim())) {
      setMetadata((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setMetadata((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file to upload');
      return;
    }

    setCurrentStep('uploading');
    setError(null);

    try {
      const uploaded: UploadedDocumentSummary[] = [];
      const totalFiles = selectedFiles.length;

      for (let i = 0; i < selectedFiles.length; i++) {
        const { file } = selectedFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filename', file.name);
        
        // Add compliance check parameters if enabled
        if (metadata.runComplianceCheck) {
          formData.append('runComplianceCheck', 'true');
          if (metadata.framework && metadata.framework !== 'auto') {
            formData.append('framework', metadata.framework);
          }
        }

        // Use the correct API endpoint with workspace ID in the path
        const response = await fetch(`/api/workspaces/${wsId}/documents`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(errorData.error || errorData.message || `Upload failed with status ${response.status}`);
        }

        const data: UploadedDocumentSummary = await response.json();
        uploaded.push(data);
        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      setUploadedDocuments(uploaded);
      setCurrentStep('complete');
    } catch (error) {
      console.error('Upload failed:', error);
      setError(getApiErrorMessage(error));
      setCurrentStep('metadata');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['doc', 'docx'].includes(ext || '')) return '📝';
    if (['xls', 'xlsx'].includes(ext || '')) return '📊';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return '🖼️';
    return '📎';
  };

  // Calculate usage after this upload
  const calculateUsageAfterUpload = () => {
    if (!usageLimits) return { used: 0, limit: 10, remaining: 10, willExceed: false, percentage: 0 };

    const futureUsed = usageLimits.uploads_used + selectedFiles.length;
    const remaining = Math.max(0, usageLimits.uploads_limit - futureUsed);
    const willExceed = futureUsed > usageLimits.uploads_limit;
    const percentage = Math.min(100, (futureUsed / usageLimits.uploads_limit) * 100);

    return {
      used: futureUsed,
      limit: usageLimits.uploads_limit,
      remaining,
      willExceed,
      percentage,
    };
  };

  // Render billing warning banner
  const renderBillingWarning = () => {
    if (!usageLimits || selectedFiles.length === 0) return null;

    const usage = calculateUsageAfterUpload();

    if (usage.willExceed) {
      return (
        <div className="mb-6 rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Upload Limit Exceeded</h3>
              <p className="text-sm text-red-800 mb-2">
                This upload would use {usage.used} of your {usage.limit} monthly upload credits.
                You need to upgrade your plan to upload {selectedFiles.length} document(s).
              </p>
              <p className="text-xs text-red-700">
                Current usage: {usageLimits.uploads_used}/{usageLimits.uploads_limit} documents ({usageLimits.subscription_tier} plan)
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
              <h3 className="font-semibold text-yellow-900 mb-1">Approaching Upload Limit</h3>
              <p className="text-sm text-yellow-800 mb-2">
                After this upload, you&rsquo;ll have used {usage.used} of {usage.limit} monthly uploads ({Math.round(usage.percentage)}%).
                Only {usage.remaining} upload(s) remaining.
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
            <h3 className="font-semibold text-blue-900 mb-1">Upload Credits</h3>
            <p className="text-sm text-blue-800">
              This upload will use {selectedFiles.length} of your {usage.remaining} remaining upload credits.
              After upload: {usage.used}/{usage.limit} used ({Math.round(usage.percentage)}%)
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 'select', label: 'Select Files', icon: '📁' },
      { id: 'metadata', label: 'Add Details', icon: '📝' },
      { id: 'uploading', label: 'Uploading', icon: '⬆️' },
      { id: 'complete', label: 'Complete', icon: '✓' },
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

  const renderSelectStep = () => {
    const usage = calculateUsageAfterUpload();

    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Documents</h2>
          <p className="text-gray-600">
            Choose the documents you want to upload for compliance checking
          </p>
        </div>

        {/* Billing Warning */}
        {renderBillingWarning()}

        {/* Drag & Drop Area */}
        <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition bg-white"
      >
        <div className="text-6xl mb-4">📤</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Drag and drop files here
        </h3>
        <p className="text-gray-600 mb-4">or</p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
          />
          <span className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer inline-block">
            Browse Files
          </span>
        </label>
        <p className="text-sm text-gray-500 mt-4">
          Supported formats: PDF, Word, Excel, Text (Max 50MB per file)
        </p>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold text-gray-900 mb-4">
            Selected Files ({selectedFiles.length})
          </h3>
          <div className="space-y-3">
            {selectedFiles.map((uploadedFile, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{getFileIcon(uploadedFile.file.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {uploadedFile.file.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatFileSize(uploadedFile.file.size)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              onClick={() => setCurrentStep('metadata')}
              disabled={usage.willExceed}
            >
              Continue →
            </Button>
          </div>
        </div>
      )}
      </div>
    );
  };

  const renderMetadataStep = () => (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Document Details</h2>
        <p className="text-gray-600">
          Provide additional information to help organize your documents
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6">
        {/* Compliance Check Section */}
        <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="runComplianceCheck"
              checked={metadata.runComplianceCheck || false}
              onChange={(e) =>
                setMetadata((prev) => ({
                  ...prev,
                  runComplianceCheck: e.target.checked,
                  framework: e.target.checked ? 'auto' : undefined,
                }))
              }
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div className="flex-1">
              <label htmlFor="runComplianceCheck" className="font-medium text-gray-900 cursor-pointer">
                Run compliance check after upload
              </label>
              <p className="text-sm text-gray-600 mt-1">
                Automatically analyze documents for compliance issues after upload completes.
              </p>
              <p className="text-xs text-blue-800 mt-2">
                ⚠️ <strong>Billing Notice:</strong> Compliance checks are billed separately from document uploads.
                Each check will consume compliance credits from your plan.
              </p>
            </div>
          </div>
        </div>

        {/* Framework Selection - Only visible when compliance check is enabled */}
        {metadata.runComplianceCheck && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Compliance Framework
            </label>
            <select
              value={metadata.framework || 'auto'}
              onChange={(e) =>
                setMetadata((prev) => ({
                  ...prev,
                  framework: e.target.value || undefined,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {frameworks.map((framework) => (
                <option key={framework.value} value={framework.value}>
                  {framework.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose a specific framework or let the system auto-detect based on document content
            </p>
          </div>
        )}

        {/* Framework Info - Only visible when specific framework is selected */}
        {!metadata.runComplianceCheck && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              💡 <strong>Tip:</strong> You can also run compliance checks later from the document detail page
              or use the batch compliance check feature to analyze multiple documents at once.
            </p>
          </div>
        )}

        {/* Description Section (moved below compliance) */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Additional Information (Optional)</h3>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={metadata.description}
              onChange={(e) =>
                setMetadata((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={4}
              placeholder="Enter a description for these documents..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="outline" onClick={addTag}>
                Add Tag
              </Button>
            </div>
            {metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {metadata.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8">
        <Button variant="outline" onClick={() => setCurrentStep('select')}>
          ← Back
        </Button>
        <Button onClick={handleUpload}>Upload {selectedFiles.length} File(s)</Button>
      </div>
    </div>
  );

  const renderUploadingStep = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="text-6xl mb-6">⬆️</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Uploading Documents</h2>
      <p className="text-gray-600 mb-8">Please wait while we upload your documents...</p>

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-semibold text-blue-600">
              {Math.round(uploadProgress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-3 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Uploading {selectedFiles.length} file(s)...
        </p>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="text-6xl mb-6">✅</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Complete!</h2>
      <p className="text-gray-600 mb-8">
        Your documents have been successfully uploaded and are being processed.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">Uploaded Documents</h3>
        <div className="space-y-3">
          {uploadedDocuments.map((doc, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getFileIcon(doc.filename)}</span>
                <span className="font-medium text-gray-900">{doc.filename}</span>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                Processing
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-2">What&rsquo;s Next?</h3>
        <ul className="text-sm text-blue-800 space-y-2 text-left">
          <li>• Documents are being processed and indexed for compliance checking</li>
          <li>• You can run compliance checks once processing is complete</li>
          <li>• You&rsquo;ll receive a notification when processing is finished</li>
          <li>• Processing typically takes 1-5 minutes depending on document size</li>
        </ul>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/documents`)}
        >
          View All Documents
        </Button>
        <Button
          onClick={() => router.push(`/org/${orgId}/workspace/${wsId}/compliance/run`)}
        >
          Run Compliance Check
        </Button>
      </div>
    </div>
  );

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Documents</h1>
          <p className="text-gray-600">
            Upload documents to your workspace for compliance checking and analysis
          </p>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        {currentStep === 'select' && renderSelectStep()}
        {currentStep === 'metadata' && renderMetadataStep()}
        {currentStep === 'uploading' && renderUploadingStep()}
        {currentStep === 'complete' && renderCompleteStep()}
      </div>
    </OrganizationLayout>
  );
}
