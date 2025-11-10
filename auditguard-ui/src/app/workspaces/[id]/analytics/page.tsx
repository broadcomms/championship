'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { ReportGeneratorModal } from '@/components/reporting';
import { ComplianceReportsList } from '@/components/reporting/ComplianceReportsList';
import { ComplianceReportDetailModal } from '@/components/reporting/ComplianceReportDetailModal';
import { FileText, TrendingUp, BarChart3 } from 'lucide-react';

interface ReportStats {
  totalReports: number;
  avgScore: number;
  trend: string;
}

export default function AnalyticsPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [stats, setStats] = useState<ReportStats>({
    totalReports: 0,
    avgScore: 0,
    trend: '-',
  });
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch report statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/reports`, {
          credentials: 'include',
        });

        if (!response.ok) return;

        const reports = await response.json();
        
        if (reports.length === 0) {
          setStats({ totalReports: 0, avgScore: 0, trend: '-' });
          return;
        }

        // Calculate stats
        const totalReports = reports.length;
        const avgScore = Math.round(
          reports.reduce((sum: number, r: any) => {
            // Handle both direct overallScore and nested overview.overallScore
            const score = r.summary?.overview?.overallScore || r.summary?.overallScore || 0;
            return sum + score;
          }, 0) / totalReports
        );

        // Calculate trend (compare latest 3 vs previous 3)
        let trend = '-';
        if (reports.length >= 2) {
          const latest = reports[0].summary?.overview?.overallScore || reports[0].summary?.overallScore || 0;
          const previous = reports[1].summary?.overview?.overallScore || reports[1].summary?.overallScore || 0;
          if (latest > previous) {
            trend = `+${(latest - previous).toFixed(1)}%`;
          } else if (latest < previous) {
            trend = `${(latest - previous).toFixed(1)}%`;
          } else {
            trend = 'No change';
          }
        }

        setStats({ totalReports, avgScore, trend });
      } catch (error) {
        console.error('Failed to fetch report stats:', error);
      }
    };

    fetchStats();
  }, [workspaceId, refreshKey]);

  const handleReportClick = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  const handleReportGenerated = () => {
    setShowReportGenerator(false);
    // Trigger refresh by incrementing key
    setRefreshKey(prev => prev + 1);
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
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalReports}
              </div>
              <p className="text-xs text-gray-500 mt-1">Generated reports</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-500">Avg Score</h3>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalReports > 0 ? `${stats.avgScore}%` : '-'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Compliance score</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-500">Trend</h3>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.trend}
              </div>
              <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
            </div>
          </div>

          {/* Reports List */}
          <ComplianceReportsList
            key={refreshKey}
            workspaceId={workspaceId}
            onReportClick={handleReportClick}
          />

          {/* Report Generator Modal */}
          <ReportGeneratorModal
            workspaceId={workspaceId}
            isOpen={showReportGenerator}
            onClose={handleReportGenerated}
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

