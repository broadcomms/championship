'use client';

import React, { useEffect, useState } from 'react';
import { ComplianceReportListItem } from '@/types/compliance';
import { FileText, Calendar, TrendingUp, AlertCircle, Clock } from 'lucide-react';

interface ComplianceReportsListProps {
  workspaceId: string;
  onReportClick: (reportId: string) => void;
}

export function ComplianceReportsList({ workspaceId, onReportClick }: ComplianceReportsListProps) {
  const [reports, setReports] = useState<ComplianceReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [workspaceId]);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/reports`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await response.json();
      setReports(data.reports || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    if (score >= 50) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">Completed</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">Processing</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">Failed</span>;
      default:
        return null;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading compliance reports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertCircle className="w-6 h-6" />
          <h3 className="text-lg font-semibold">Error Loading Reports</h3>
        </div>
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchReports}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Generated Yet</h3>
        <p className="text-gray-600 mb-4">
          Generate your first compliance report to see insights and analytics here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Generated Reports ({reports.length})
        </h3>
      </div>

      <div className="grid gap-4">
        {reports.map((report) => (
          <div
            key={report.id}
            onClick={() => onReportClick(report.id)}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200 hover:border-blue-300"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-1">
                      {report.name}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {formatDate(report.createdAt)}
                    </div>
                  </div>
                </div>
                {getStatusBadge(report.status)}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${getScoreColor(report.overallScore)}`}>
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Overall Score</div>
                    <div className="text-xl font-bold text-gray-900">{report.overallScore}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-orange-50">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total Issues</div>
                    <div className="text-xl font-bold text-gray-900">{report.totalIssues}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-red-50">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Critical Issues</div>
                    <div className="text-xl font-bold text-gray-900">{report.criticalIssues}</div>
                  </div>
                </div>
              </div>

              {/* Frameworks */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">Frameworks:</span>
                {report.frameworks.map((framework) => (
                  <span
                    key={framework}
                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-full"
                  >
                    {framework}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
