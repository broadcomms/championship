'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { ReportGeneratorModal } from '@/components/reporting';
import { ComplianceReportsList } from '@/components/reporting/ComplianceReportsList';
import { ComplianceReportDetailModal } from '@/components/reporting/ComplianceReportDetailModal';
import { FileText, TrendingUp, BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const handleReportClick = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  return (
    <AppLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
              <p className="text-gray-500 mt-1">
                View insights and metrics for your workspace
              </p>
            </div>
            <button
              onClick={() => setShowReportGenerator(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <FileText className="h-4 w-4" />
              Generate Report
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-500">Total Reports</h3>
              </div>
              <div className="text-2xl font-bold text-gray-900">-</div>
              <p className="text-xs text-gray-500 mt-1">Generated reports</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-500">Avg Score</h3>
              </div>
              <div className="text-2xl font-bold text-gray-900">-</div>
              <p className="text-xs text-gray-500 mt-1">Compliance score</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-500">Trend</h3>
              </div>
              <div className="text-2xl font-bold text-gray-900">-</div>
              <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
            </div>
          </div>

          {/* Reports List */}
          <ComplianceReportsList
            workspaceId={workspaceId}
            onReportClick={handleReportClick}
          />

          {/* Report Generator Modal */}
          <ReportGeneratorModal
            workspaceId={workspaceId}
            isOpen={showReportGenerator}
            onClose={() => setShowReportGenerator(false)}
          />

          {/* Report Detail Modal */}
          <ComplianceReportDetailModal
            workspaceId={workspaceId}
            reportId={selectedReportId}
            isOpen={selectedReportId !== null}
            onClose={() => setSelectedReportId(null)}
          />
        </div>
      </div>
    </AppLayout>
  );
}

