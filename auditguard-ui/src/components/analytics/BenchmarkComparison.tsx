import React from 'react';
import { TrendingUp, TrendingDown, Minus, Award, AlertCircle } from 'lucide-react';

interface BenchmarkComparisonProps {
  workspaceId: string;
  industry?: 'healthcare' | 'finance' | 'technology' | 'retail' | 'government' | 'general';
  size?: 'small' | 'medium' | 'large' | 'enterprise';
}

interface BenchmarkData {
  workspace: {
    overallScore: number;
    frameworkCount: number;
    documentsCovered: number;
    issueResolutionRate: number;
  };
  benchmarks: {
    industry: string;
    size: string;
    averageScore: number;
    topQuartileScore: number;
    frameworkAdoptionRate: Record<string, number>;
    averageIssueResolutionTime: number;
    bestPractices: string[];
  };
  comparison: {
    scorePercentile: number;
    performanceRating: 'excellent' | 'above-average' | 'average' | 'below-average' | 'needs-improvement';
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  peerInsights: {
    betterThan: number;
    similarTo: number;
    worseThan: number;
  };
}

export default function BenchmarkComparison({
  workspaceId,
  industry = 'general',
  size = 'medium',
}: BenchmarkComparisonProps) {
  const [data, setData] = React.useState<BenchmarkData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchBenchmarks = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (industry) params.set('industry', industry);
        if (size) params.set('size', size);

        const response = await fetch(
          `/api/workspaces/${workspaceId}/analytics/benchmarks?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch benchmark data');
        }

        const benchmarkData = await response.json();
        setData(benchmarkData);
        setError(null);
      } catch (err) {
        console.error('Error fetching benchmarks:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBenchmarks();
  }, [workspaceId, industry, size]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p className="font-medium">Failed to load benchmark data</p>
        </div>
        {error && <p className="text-sm text-gray-600 mt-2">{error}</p>}
      </div>
    );
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'above-average':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'average':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'below-average':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'needs-improvement':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'excellent':
      case 'above-average':
        return <TrendingUp className="h-5 w-5" />;
      case 'below-average':
      case 'needs-improvement':
        return <TrendingDown className="h-5 w-5" />;
      default:
        return <Minus className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Performance Rating Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Industry Benchmark</h3>
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getRatingColor(
              data.comparison.performanceRating
            )}`}
          >
            {getRatingIcon(data.comparison.performanceRating)}
            <span className="font-medium capitalize">
              {data.comparison.performanceRating.replace('-', ' ')}
            </span>
          </div>
        </div>

        {/* Score Comparison Bar */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Your Score</span>
              <span className="text-2xl font-bold text-gray-900">
                {data.workspace.overallScore}
              </span>
            </div>
            <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="absolute h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${data.workspace.overallScore}%` }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-700">
                  You: {data.workspace.overallScore}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Industry Average</span>
              <span className="text-lg font-semibold text-gray-600">
                {data.benchmarks.averageScore}
              </span>
            </div>
            <div className="relative h-6 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="absolute h-full bg-gray-400 transition-all duration-500"
                style={{ width: `${data.benchmarks.averageScore}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Top Quartile</span>
              <span className="text-lg font-semibold text-gray-600">
                {data.benchmarks.topQuartileScore}
              </span>
            </div>
            <div className="relative h-6 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="absolute h-full bg-green-400 transition-all duration-500"
                style={{ width: `${data.benchmarks.topQuartileScore}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Percentile Badge */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <Award className="h-6 w-6 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">Percentile Ranking</p>
              <p className="text-2xl font-bold text-blue-600">
                {data.comparison.scorePercentile}th
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Better than {data.peerInsights.betterThan}% of peers in {data.benchmarks.industry}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Strengths</h3>
          </div>
          <ul className="space-y-2">
            {data.comparison.strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0"></div>
                <span className="text-sm text-gray-700">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Areas for Improvement</h3>
          </div>
          <ul className="space-y-2">
            {data.comparison.weaknesses.map((weakness, index) => (
              <li key={index} className="flex items-start gap-2">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0"></div>
                <span className="text-sm text-gray-700">{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Recommendations</h3>
        <ul className="space-y-3">
          {data.comparison.recommendations.map((recommendation, index) => (
            <li key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">{index + 1}</span>
              </div>
              <span className="text-sm text-gray-700">{recommendation}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Best Practices */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          Industry Best Practices ({data.benchmarks.industry})
        </h3>
        <ul className="grid md:grid-cols-2 gap-3">
          {data.benchmarks.bestPractices.map((practice, index) => (
            <li key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0"></div>
              <span className="text-sm text-gray-700">{practice}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
