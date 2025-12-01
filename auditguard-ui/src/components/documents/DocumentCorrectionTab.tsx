'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';

interface DocumentCorrectionTabProps {
  workspaceId: string;
  documentId: string;
  document: {
    filename: string;
    characterCount?: number;
    pageCount?: number;
  };
}

interface CorrectionResult {
  success: boolean;
  correctedText: string;
  correctionsApplied: string[];
  generatedAt: number;
  modelUsed: string;
  issuesAddressed: number;
  error?: string;
}

interface ComplianceIssue {
  severity: string;
  title: string;
}

export function DocumentCorrectionTab({
  workspaceId,
  documentId,
  document,
}: DocumentCorrectionTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'preview' | 'markdown'>('preview');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Fetch compliance issues AND existing correction on mount
  useEffect(() => {
    fetchIssues();
    fetchExistingCorrection();
  }, [workspaceId, documentId]);

  const fetchIssues = async () => {
    setIssuesLoading(true);
    try {
      const data = await api.get<any>(
        `/api/workspaces/${workspaceId}/documents/${documentId}/issues`
      );
      // Handle different API response formats
      if (Array.isArray(data)) {
        setIssues(data);
      } else if (data && Array.isArray(data.issues)) {
        setIssues(data.issues);
      } else {
        console.warn('Unexpected API response format:', data);
        setIssues([]);
      }
    } catch (err) {
      console.error('Failed to fetch issues:', err);
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  };

  const fetchExistingCorrection = async () => {
    setLoadingExisting(true);
    try {
      const data = await api.get<any>(
        `/api/workspaces/${workspaceId}/documents/${documentId}`
      );
      
      // Check if document has a saved correction
      if (data.corrected_text && data.corrected_at) {
        console.log('✅ Loaded existing correction from database');
        
        // Reconstruct correction result from database fields
        setCorrectionResult({
          success: true,
          correctedText: data.corrected_text,
          correctionsApplied: [], // We don't store this in DB, will regenerate if needed
          generatedAt: data.corrected_at,
          modelUsed: 'llama-3.3-70b',
          issuesAddressed: data.corrections_count || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch existing correction:', err);
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleGenerateCorrection = async () => {
    setIsGenerating(true);
    setError('');
    setGenerationProgress(0);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => Math.min(prev + 10, 90));
    }, 500);

    try {
      const result = await api.post<CorrectionResult>(
        `/api/workspaces/${workspaceId}/documents/${documentId}/correct`,
        {}
      );

      clearInterval(progressInterval);
      setGenerationProgress(100);

      if (result.success) {
        setCorrectionResult(result);
      } else {
        setError(result.error || 'Failed to generate correction');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || 'Failed to generate corrected document');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!correctionResult) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(document.filename.replace('.pdf', ' (Corrected)'), margin, yPosition);
    yPosition += 10;

    // Content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const lines = correctionResult.correctedText.split('\n');

    for (const line of lines) {
      // Handle markdown headers
      if (line.startsWith('# ')) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        const text = line.replace(/^# /, '');
        const splitLines = doc.splitTextToSize(text, maxWidth);
        for (const splitLine of splitLines) {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(splitLine, margin, yPosition);
          yPosition += 7;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      } else if (line.startsWith('## ')) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const text = line.replace(/^## /, '');
        const splitLines = doc.splitTextToSize(text, maxWidth);
        for (const splitLine of splitLines) {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(splitLine, margin, yPosition);
          yPosition += 6;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      } else if (line.startsWith('### ')) {
        doc.setFont('helvetica', 'bold');
        const text = line.replace(/^### /, '');
        const splitLines = doc.splitTextToSize(text, maxWidth);
        for (const splitLine of splitLines) {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(splitLine, margin, yPosition);
          yPosition += 5;
        }
        doc.setFont('helvetica', 'normal');
      } else {
        // Regular text
        const splitLines = doc.splitTextToSize(line || ' ', maxWidth);
        for (const splitLine of splitLines) {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(splitLine, margin, yPosition);
          yPosition += 5;
        }
      }
    }

    doc.save(document.filename.replace('.pdf', '_corrected.pdf'));
  };

  const handleDownloadMarkdown = () => {
    if (!correctionResult) return;

    const blob = new Blob([correctionResult.correctedText], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = document.filename.replace('.pdf', '_corrected.md');
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Safely compute issue counts by severity
  const issueCountsBySeverity = Array.isArray(issues) 
    ? issues.reduce((acc, issue) => {
        const severity = issue.severity?.toLowerCase() || 'unknown';
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Document Correction</h2>
        <p className="mt-2 text-sm text-gray-600">
          This feature uses AI to automatically generate a corrected version of your document
          based on all identified compliance issues.
        </p>
      </div>

      {/* Loading State */}
      {loadingExisting && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-3 text-sm text-gray-600">Loading existing correction...</p>
        </div>
      )}

      {/* Error Display */}
      {!loadingExisting && error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Correction Summary */}
      {!loadingExisting && !correctionResult && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-gray-900">Correction Summary</h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Document</dt>
              <dd className="mt-1 text-sm text-gray-900">{document.filename}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Issues</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {issuesLoading ? 'Loading...' : `${issues.length} issues identified`}
              </dd>
            </div>
            {!issuesLoading && issues.length > 0 && (
              <>
                <div>
                  <dt className="text-sm font-medium text-gray-500">High</dt>
                  <dd className="mt-1 text-sm text-red-600 font-medium">
                    {issueCountsBySeverity.high || 0} issues
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Medium</dt>
                  <dd className="mt-1 text-sm text-yellow-600 font-medium">
                    {issueCountsBySeverity.medium || 0} issues
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Low</dt>
                  <dd className="mt-1 text-sm text-blue-600 font-medium">
                    {issueCountsBySeverity.low || 0} issues
                  </dd>
                </div>
              </>
            )}
            {document.characterCount && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Extracted Text</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {document.characterCount.toLocaleString()} characters
                </dd>
              </div>
            )}
            {document.pageCount && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Pages</dt>
                <dd className="mt-1 text-sm text-gray-900">{document.pageCount} pages</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Generate Button or Progress */}
      {!loadingExisting && !correctionResult && !isGenerating && (
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
          <Button
            variant="primary"
            size="lg"
            onClick={handleGenerateCorrection}
            disabled={issuesLoading || issues.length === 0}
            className="w-full"
          >
            🔄 Generate Corrected Document
          </Button>
          <div className="mt-4 space-y-2 text-sm text-gray-600">
            <p className="font-medium">How it works:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Collects all extracted text from your document</li>
              <li>Gathers all identified compliance issues with recommendations</li>
              <li>Uses Cerebras AI (llama-3.3-70b) to generate corrected version</li>
              <li>Returns corrected document in markdown format</li>
              <li>Allows you to review, edit, and export as PDF</li>
            </ol>
            <p className="mt-3 text-xs text-gray-500">
              Note: This may take 30-60 seconds depending on document size.
            </p>
          </div>
        </div>
      )}

      {/* Generation Progress */}
      {!loadingExisting && isGenerating && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Generating Corrected Document...
          </h3>
          <div className="space-y-4">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
            <div className="space-y-2 text-sm">
              <p className={generationProgress >= 10 ? 'text-green-600' : 'text-gray-500'}>
                {generationProgress >= 10 ? '✓' : '⏳'} Collected document text
              </p>
              <p className={generationProgress >= 30 ? 'text-green-600' : 'text-gray-500'}>
                {generationProgress >= 30 ? '✓' : '⏳'} Gathered compliance issues
              </p>
              <p className={generationProgress >= 50 ? 'text-green-600' : 'text-gray-500'}>
                {generationProgress >= 50 ? '✓' : '⏳'} Generating corrected version with AI...
              </p>
              <p className={generationProgress >= 90 ? 'text-green-600' : 'text-gray-500'}>
                {generationProgress >= 90 ? '✓' : '⏳'} Processing response...
              </p>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              This may take 30-60 seconds. Please wait...
            </p>
          </div>
        </div>
      )}

      {/* Corrected Document Display */}
      {!loadingExisting && correctionResult && (
        <div className="space-y-4">
          {/* Header with Actions */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Corrected Document</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
                💾 Download Markdown
              </Button>
              <Button variant="primary" size="sm" onClick={handleExportPDF}>
                📄 Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleGenerateCorrection}>
                🔄 Regenerate
              </Button>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 border-b border-gray-200">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'preview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'markdown'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Raw Markdown
            </button>
          </div>

          {/* Content Display */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 max-h-[600px] overflow-y-auto">
            {viewMode === 'preview' ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{correctionResult.correctedText}</ReactMarkdown>
              </div>
            ) : (
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {correctionResult.correctedText}
              </pre>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="space-x-4">
              <span>Generated: {new Date(correctionResult.generatedAt).toLocaleString()}</span>
              <span>Model: Cerebras {correctionResult.modelUsed}</span>
            </div>
            <span className="font-medium">
              Issues Addressed: {correctionResult.issuesAddressed}/{issues.length}
            </span>
          </div>

          {/* Corrections Applied */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Corrections Applied:</h4>
            <ul className="space-y-1">
              {correctionResult.correctionsApplied.map((correction, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-green-600 flex-shrink-0">✓</span>
                  <span>{correction}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
