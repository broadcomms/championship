'use client';

import React, { useState } from 'react';
import { X, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import {
  ComplianceFramework,
  ReportFormat,
  ReportGenerationRequest,
  ExecutiveSummaryRequest,
} from '@/types';

interface ReportGeneratorModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

const FRAMEWORKS: { value: ComplianceFramework; label: string }[] = [
  { value: 'GDPR', label: 'GDPR' },
  { value: 'HIPAA', label: 'HIPAA' },
  { value: 'SOC2', label: 'SOC 2' },
  { value: 'PCI_DSS', label: 'PCI DSS' },
  { value: 'ISO_27001', label: 'ISO 27001' },
  { value: 'NIST_CSF', label: 'NIST CSF' },
  { value: 'CCPA', label: 'CCPA' },
  { value: 'FERPA', label: 'FERPA' },
  { value: 'GLBA', label: 'GLBA' },
  { value: 'FISMA', label: 'FISMA' },
  { value: 'PIPEDA', label: 'PIPEDA' },
  { value: 'COPPA', label: 'COPPA' },
  { value: 'SOX', label: 'SOX' },
];

export function ReportGeneratorModal({
  workspaceId,
  isOpen,
  onClose,
}: ReportGeneratorModalProps) {
  const [reportType, setReportType] = useState<'data' | 'executive'>('data');
  const [format, setFormat] = useState<ReportFormat>('json');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeChecks, setIncludeChecks] = useState(true);
  const [includeIssues, setIncludeIssues] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFrameworkToggle = (framework: string) => {
    setSelectedFrameworks((prev) =>
      prev.includes(framework)
        ? prev.filter((f) => f !== framework)
        : [...prev, framework]
    );
  };

  const handleSelectAllFrameworks = () => {
    if (selectedFrameworks.length === FRAMEWORKS.length) {
      setSelectedFrameworks([]);
    } else {
      setSelectedFrameworks(FRAMEWORKS.map((f) => f.value));
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      if (reportType === 'executive') {
        // Generate executive summary
        const request: ExecutiveSummaryRequest = {
          workspaceId,
          ...(selectedFrameworks.length > 0 && { frameworks: selectedFrameworks }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
        };

        const response = await fetch(`/api/workspaces/${workspaceId}/reports/executive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error('Failed to generate executive summary');
        }

        const summary = await response.json();
        
        // Save report to backend
        const reportName = `Compliance Report - ${new Date().toLocaleDateString()}`;
        const saveResponse = await fetch(`/api/workspaces/${workspaceId}/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: reportName,
            frameworks: selectedFrameworks.length > 0 ? selectedFrameworks : [],
            reportPeriod: {
              startDate: startDate || Date.now() - 30 * 24 * 60 * 60 * 1000,
              endDate: endDate || Date.now(),
            },
            summary,
          }),
        });

        if (!saveResponse.ok) {
          console.error('Failed to save report to backend');
          // Don't throw - still show success if generation worked
        }

        setSuccess(true);
        setTimeout(() => {
          onClose();
          // Don't reload - parent will refresh via key prop
        }, 1500);
      } else {
        // Generate data export
        const request: ReportGenerationRequest = {
          workspaceId,
          format,
          ...(selectedFrameworks.length > 0 && { frameworks: selectedFrameworks }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
          includeChecks,
          includeIssues,
        };

        const response = await fetch(
          `/api/workspaces/${workspaceId}/reports/export/${format}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(request),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to generate report');
        }

        const result = await response.json();

        // Download the file
        const mimeType = format === 'json' ? 'application/json' : 'text/csv';
        const blob = new Blob([result.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Generate Compliance Report
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              disabled={generating}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Report Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setReportType('data')}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    reportType === 'data'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={generating}
                >
                  <div className="font-medium text-gray-900">Compliance Data Export</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Export checks, issues, and compliance data
                  </div>
                </button>
                <button
                  onClick={() => setReportType('executive')}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    reportType === 'executive'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={generating}
                >
                  <div className="font-medium text-gray-900">Executive Summary</div>
                  <div className="text-sm text-gray-600 mt-1">
                    AI-powered summary with key findings
                  </div>
                </button>
              </div>
            </div>

            {/* Format Selection (only for data export) */}
            {reportType === 'data' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormat('json')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      format === 'json'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    disabled={generating}
                  >
                    <div className="font-medium text-gray-900">JSON</div>
                    <div className="text-xs text-gray-600">Structured data</div>
                  </button>
                  <button
                    onClick={() => setFormat('csv')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      format === 'csv'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    disabled={generating}
                  >
                    <div className="font-medium text-gray-900">CSV</div>
                    <div className="text-xs text-gray-600">Spreadsheet format</div>
                  </button>
                </div>
              </div>
            )}

            {/* Framework Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Frameworks (optional)
                </label>
                <button
                  onClick={handleSelectAllFrameworks}
                  className="text-sm text-blue-600 hover:text-blue-700"
                  disabled={generating}
                >
                  {selectedFrameworks.length === FRAMEWORKS.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                {FRAMEWORKS.map((framework) => (
                  <label
                    key={framework.value}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFrameworks.includes(framework.value)}
                      onChange={() => handleFrameworkToggle(framework.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={generating}
                    />
                    <span className="text-sm text-gray-700">{framework.label}</span>
                  </label>
                ))}
              </div>
              {selectedFrameworks.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to include all frameworks
                </p>
              )}
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range (optional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={generating}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={generating}
                  />
                </div>
              </div>
            </div>

            {/* Include Options (only for data export) */}
            {reportType === 'data' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Include in Export
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeChecks}
                      onChange={(e) => setIncludeChecks(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={generating}
                    />
                    <span className="text-sm text-gray-700">Compliance Checks</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeIssues}
                      onChange={(e) => setIncludeIssues(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={generating}
                    />
                    <span className="text-sm text-gray-700">Compliance Issues</span>
                  </label>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start space-x-2 rounded-lg bg-red-50 p-3 border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-start space-x-2 rounded-lg bg-green-50 p-3 border border-green-200">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  Report generated successfully! Download should start automatically.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              disabled={generating}
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={generating || (!includeChecks && !includeIssues && reportType === 'data')}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
