'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  Clock,
  Star,
  Users,
  Activity,
  Zap,
  DollarSign,
  BarChart3,
  Download,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import {
  AnalyticsDashboard as AnalyticsDashboardType,
  Metric,
  TimeRange,
  TimeRangeFilter,
  TIME_RANGE_LABELS,
  TOOL_COLORS,
  FRAMEWORK_COLORS,
} from '@/types/analytics';

interface AnalyticsDashboardProps {
  workspaceId: string;
  initialTimeRange?: TimeRange;
}

export default function AnalyticsDashboard({ workspaceId, initialTimeRange = 'week' }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsDashboardType | null>(null);

  // Load analytics data
  useEffect(() => {
    loadAnalytics();
  }, [workspaceId, timeRange]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/assistant/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          timeRange: { type: timeRange },
          includeDetails: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/assistant/analytics/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          format: 'csv',
          timeRange: { type: timeRange },
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${timeRange}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No analytics data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">AI Assistant Analytics</h2>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
            {(['today', 'week', 'month', 'quarter', 'year'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {TIME_RANGE_LABELS[range]}
              </button>
            ))}
          </div>
          <button
            onClick={loadAnalytics}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metric={analytics.metrics.conversations}
          icon={<MessageSquare className="w-6 h-6" />}
        />
        <MetricCard
          metric={analytics.metrics.responseTime}
          icon={<Clock className="w-6 h-6" />}
        />
        <MetricCard
          metric={analytics.metrics.satisfaction}
          icon={<Star className="w-6 h-6" />}
        />
        <MetricCard
          metric={analytics.metrics.activeUsers}
          icon={<Users className="w-6 h-6" />}
        />
      </div>

      {/* Usage Trends Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={analytics.usageTrends}>
            <defs>
              <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              stroke="#6B7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="messages"
              stroke="#2563EB"
              fillOpacity={1}
              fill="url(#colorMessages)"
              name="Messages"
            />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke="#22C55E"
              fillOpacity={1}
              fill="url(#colorSessions)"
              name="Sessions"
            />
            <Area
              type="monotone"
              dataKey="voiceMessages"
              stroke="#A855F7"
              fill="transparent"
              name="Voice Messages"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tool Usage */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tool Usage</h3>
          <div className="space-y-3">
            {analytics.toolUsage.map((tool, index) => (
              <div key={tool.toolName} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{tool.toolName}</span>
                  <span className="text-gray-500">{tool.count}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${tool.percentage}%`,
                      backgroundColor: TOOL_COLORS[index % TOOL_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Response Quality */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Quality</h3>
          <div className="space-y-4">
            <QualityBar label="Helpful" value={analytics.responseQuality.helpful} />
            <QualityBar label="Accurate" value={analytics.responseQuality.accurate} />
            <QualityBar label="Complete" value={analytics.responseQuality.complete} />
            <QualityBar label="Actionable" value={analytics.responseQuality.actionable} />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Average Score</span>
              <span className="text-2xl font-bold text-blue-600">
                {analytics.responseQuality.avgScore.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User Engagement & Cost Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Engagement */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Engagement</h3>
          <div className="space-y-4">
            <EngagementMetric
              label="Avg Session Duration"
              value={`${Math.floor(analytics.userEngagement.avgSessionDuration / 60)} min`}
              icon={<Clock className="w-5 h-5 text-blue-600" />}
            />
            <EngagementMetric
              label="Messages per Session"
              value={analytics.userEngagement.messagesPerSession.toFixed(1)}
              icon={<MessageSquare className="w-5 h-5 text-green-600" />}
            />
            <EngagementMetric
              label="Return Rate"
              value={`${analytics.userEngagement.returnRate}%`}
              icon={<Activity className="w-5 h-5 text-purple-600" />}
            />
            <EngagementMetric
              label="Voice Usage Rate"
              value={`${analytics.userEngagement.voiceUsageRate}%`}
              icon={<Zap className="w-5 h-5 text-yellow-600" />}
            />
          </div>
        </div>

        {/* Cost Analysis */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Analysis</h3>
          <div className="space-y-4">
            <CostMetric
              label="Total Tokens"
              value={analytics.costAnalysis.totalTokens.toLocaleString()}
            />
            <CostMetric
              label="API Cost"
              value={`$${analytics.costAnalysis.apiCost.toFixed(2)}`}
            />
            <CostMetric
              label="Cost per Session"
              value={`$${analytics.costAnalysis.costPerSession.toFixed(3)}`}
            />
            <CostMetric
              label="Est. Monthly Cost"
              value={`$${analytics.costAnalysis.estimatedMonthlyCost.toFixed(2)}`}
            />
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">ROI</span>
                <span className="text-2xl font-bold text-green-600">
                  {analytics.costAnalysis.roi}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Questions & Compliance Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Questions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Questions</h3>
          <div className="space-y-3">
            {analytics.topQuestions.slice(0, 5).map((question, index) => (
              <div key={question.id} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{question.question}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {question.count} times · {question.category}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Intelligence */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Intelligence</h3>
          <div className="space-y-3">
            {analytics.complianceIntelligence.map((framework) => (
              <div key={framework.framework} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{framework.framework}</span>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>{framework.issuesResolved}/{framework.issuesDetected}</span>
                    <span className={`font-medium ${
                      framework.resolutionRate >= 80 ? 'text-green-600' :
                      framework.resolutionRate >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      ({framework.resolutionRate}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${framework.resolutionRate}%`,
                      backgroundColor: FRAMEWORK_COLORS[framework.framework as keyof typeof FRAMEWORK_COLORS] || '#2563EB',
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Total</span>
                <span className="text-gray-600">
                  {analytics.complianceIntelligence.reduce((sum, f) => sum + f.issuesResolved, 0)} /
                  {analytics.complianceIntelligence.reduce((sum, f) => sum + f.issuesDetected, 0)} issues resolved
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ metric, icon }: { metric: Metric; icon: React.ReactNode }) {
  const trendIcon =
    metric.trend === 'up' ? <TrendingUp className="w-4 h-4" /> :
    metric.trend === 'down' ? <TrendingDown className="w-4 h-4" /> :
    <Minus className="w-4 h-4" />;

  const trendColor =
    metric.trend === 'up' ? 'text-green-600' :
    metric.trend === 'down' ? 'text-red-600' :
    'text-gray-600';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-2">
        <div className="text-gray-600">{icon}</div>
        <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
          {trendIcon}
          <span>{metric.changePercentage ? `${Math.abs(metric.changePercentage)}%` : ''}</span>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-3xl font-bold text-gray-900">
          {metric.value}{metric.unit || ''}
        </p>
        <p className="text-sm text-gray-500">{metric.label}</p>
      </div>
    </div>
  );
}

// Quality Bar Component
function QualityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{value}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// Engagement Metric Component
function EngagementMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

// Cost Metric Component
function CostMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
