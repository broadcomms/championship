'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Clock, DollarSign, Zap, Sparkles } from 'lucide-react';

interface ValueMetrics {
  roi_score: number;
  time_saved_hours: number;
  time_saved_value: number;
  compliance_checks_automated: number;
  compliance_checks_value: number;
  ai_messages_used: number;
  ai_efficiency_score: number;
  documents_processed: number;
  period_days: number;
}

interface ValueMetricsWidgetProps {
  workspaceId: string;
}

export function ValueMetricsWidget({ workspaceId }: ValueMetricsWidgetProps) {
  const [metrics, setMetrics] = useState<ValueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, [workspaceId]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/value-metrics?days=30`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch value metrics');
      }
      
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching value metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Value Dashboard</h3>
        <p className="text-sm text-gray-500">Unable to load metrics. Please try again later.</p>
      </div>
    );
  }

  const totalValue = metrics.time_saved_value + metrics.compliance_checks_value;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg p-6 border border-purple-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Your Impact (Last {metrics.period_days} Days)
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            See the value AuditGuard delivers to your team
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-purple-600">
            {metrics.roi_score}%
          </div>
          <div className="text-xs text-gray-600">ROI Score</div>
        </div>
      </div>

      {/* Total Value Saved */}
      <div className="bg-white rounded-lg p-4 mb-4 border-2 border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                ${totalValue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Value Delivered</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Est. cost savings</div>
            <div className="text-sm font-semibold text-green-600">
              vs. manual processes
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Time Saved */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Time Saved</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {Math.round(metrics.time_saved_hours)}h
          </div>
          <div className="text-xs text-gray-600">
            ≈ ${metrics.time_saved_value.toLocaleString()} value
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Based on {metrics.ai_messages_used} AI interactions
          </div>
        </div>

        {/* Compliance Checks */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Cost Savings</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            ${metrics.compliance_checks_value.toLocaleString()}
          </div>
          <div className="text-xs text-gray-600">
            {metrics.compliance_checks_automated} automated checks
          </div>
          <div className="mt-2 text-xs text-gray-500">
            vs. $100/check manual audit
          </div>
        </div>

        {/* AI Efficiency */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            <span className="text-sm font-medium text-gray-700">AI Efficiency</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics.ai_efficiency_score}%
          </div>
          <div className="text-xs text-gray-600">
            Productivity boost
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {metrics.documents_processed} docs processed
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Value Breakdown</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">AI Assistant Time Savings</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              ${metrics.time_saved_value.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Automated Compliance Checks</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              ${metrics.compliance_checks_value.toLocaleString()}
            </span>
          </div>
          <div className="border-t border-gray-200 my-2"></div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-900">Total Value</span>
            <span className="text-sm font-bold text-purple-600">
              ${totalValue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      {metrics.roi_score > 200 && (
        <div className="mt-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold mb-1">🎉 Amazing ROI!</div>
              <div className="text-sm opacity-90">
                You're getting incredible value. Upgrade for even more features!
              </div>
            </div>
            <button
              onClick={() => window.location.href = `/billing?tab=plans`}
              className="bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              See Plans
            </button>
          </div>
        </div>
      )}

      {/* Refresh Note */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        Metrics updated in real-time • Calculations based on industry averages
      </div>
    </div>
  );
}
