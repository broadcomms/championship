'use client';

import React, { useEffect, useState } from 'react';
import { ComplianceReport } from '@/types/compliance';
import { 
  X, 
  Download, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Calendar,
  FileText,
  Shield,
  Activity
} from 'lucide-react';

interface ComplianceReportDetailModalProps {
  workspaceId: string;
  reportId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ComplianceReportDetailModal({
  workspaceId,
  reportId,
  isOpen,
  onClose,
}: ComplianceReportDetailModalProps) {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isOpen && reportId) {
      fetchReport();
    }
  }, [isOpen, reportId]);

  const fetchReport = async () => {
    if (!reportId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/reports/${reportId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    if (!report) return;

    setExporting(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/reports/${reportId}/export/${format}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error(`Failed to export as ${format.toUpperCase()}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name.replace(/\s+/g, '-')}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getMaturityLabel = (level: number) => {
    const labels = ['Initial', 'Managed', 'Defined', 'Quantitatively Managed', 'Optimizing'];
    return labels[level - 1] || 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading report...</p>
            </div>
          ) : error ? (
            <div className="p-8">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-semibold">Error Loading Report</h3>
              </div>
              <p className="text-gray-600">{error}</p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={fetchReport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          ) : report ? (
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white" id="modal-title">
                      {report.name}
                    </h3>
                    <div className="mt-2 flex items-center gap-4 text-sm text-blue-100">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(report.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {report.summary.reportPeriod.startDate} to {report.summary.reportPeriod.endDate}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-md text-white hover:bg-blue-700 p-1 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Export Buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleExport('json')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-md text-sm disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    JSON
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-md text-sm disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-md text-sm disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                {/* Overview Section */}
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Overview
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <div className="text-2xl font-bold text-blue-900">
                        {report.summary.overview.overallScore}
                      </div>
                      <div className="text-sm text-blue-700">Overall Score</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                      <div className="text-2xl font-bold text-purple-900">
                        Level {report.summary.overview.maturityLevel}
                      </div>
                      <div className="text-sm text-purple-700">
                        {getMaturityLabel(report.summary.overview.maturityLevel)}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                      <div className="text-2xl font-bold text-green-900">
                        {report.summary.overview.coveragePercentage}%
                      </div>
                      <div className="text-sm text-green-700">
                        {report.summary.overview.documentsChecked}/{report.summary.overview.totalDocuments} docs
                      </div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                      <div className="text-2xl font-bold text-orange-900">
                        {report.summary.overview.totalIssues}
                      </div>
                      <div className="text-sm text-orange-700">
                        {report.summary.overview.criticalIssues} critical
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Findings */}
                {report.summary.keyFindings.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Key Findings
                    </h4>
                    <ul className="space-y-2">
                      {report.summary.keyFindings.map((finding, index) => (
                        <li key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                            {index + 1}
                          </span>
                          <span className="text-gray-700">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Top Risks */}
                {report.summary.topRisks.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      Top Risks
                    </h4>
                    <div className="space-y-3">
                      {report.summary.topRisks.map((risk, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                {risk.framework}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                risk.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                risk.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                risk.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {risk.severity.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {risk.issueCount} issues
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{risk.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Framework Summary */}
                {report.summary.frameworkSummary.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      Framework Summary
                    </h4>
                    <div className="grid gap-3">
                      {report.summary.frameworkSummary.map((fw, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-gray-900">{fw.framework}</h5>
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                              fw.status === 'compliant' ? 'bg-green-100 text-green-700' :
                              fw.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {fw.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Score:</span>
                              <span className="ml-2 font-semibold text-gray-900">{fw.score}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Checks:</span>
                              <span className="ml-2 font-semibold text-gray-900">{fw.checksCompleted}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Issues:</span>
                              <span className="ml-2 font-semibold text-gray-900">{fw.issuesFound}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-600" />
                    Recommendations
                  </h4>
                  <div className="space-y-3">
                    {report.summary.recommendations.map((rec, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-semibold text-gray-900">{rec.title}</h5>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(rec.priority)}`}>
                            {rec.priority.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                        <div className="text-xs text-gray-500">
                          Estimated effort: {rec.estimatedEffort}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trends */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Trends
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="text-2xl font-bold text-blue-900">
                        {report.summary.trends.scoreChange > 0 ? '+' : ''}
                        {report.summary.trends.scoreChange}
                      </div>
                      <div className="text-sm text-blue-700">Score Change</div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                      <div className="text-2xl font-bold text-orange-900">
                        {report.summary.trends.issueChange > 0 ? '+' : ''}
                        {report.summary.trends.issueChange}
                      </div>
                      <div className="text-sm text-orange-700">Issue Change</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                      <div className="text-2xl font-bold text-green-900">
                        {report.summary.trends.coverageChange > 0 ? '+' : ''}
                        {report.summary.trends.coverageChange}%
                      </div>
                      <div className="text-sm text-green-700">Coverage Change</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
