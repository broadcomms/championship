'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getFrameworkColor, getScoreColor } from '@/lib/analytics/colors';

interface FrameworkScore {
  framework?: string;
  frameworkId?: string;
  frameworkName?: string;
  displayName?: string;
  score: number;
  checksPassed?: number;
  checksFailed?: number;
  totalChecks?: number;
  checksCount?: number;
}

interface FrameworkComparisonChartProps {
  frameworks: FrameworkScore[];
  className?: string;
}

export function FrameworkComparisonChart({ frameworks, className = '' }: FrameworkComparisonChartProps) {
  if (!frameworks || frameworks.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Framework Comparison</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No framework data available
        </div>
      </div>
    );
  }

  // Sort frameworks by score (highest first)
  const sortedFrameworks = [...frameworks].sort((a, b) => b.score - a.score);

  const chartData = sortedFrameworks.map(fw => ({
    name: fw.displayName || fw.frameworkName || fw.framework || fw.frameworkId || 'Unknown',
    score: fw.score,
    checks: fw.checksCount || fw.totalChecks || 0,
    passed: fw.checksPassed || 0,
    failed: fw.checksFailed || 0,
  }));

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Framework Comparison</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart 
          data={chartData} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            type="number" 
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
          />
          <YAxis 
            type="category" 
            dataKey="name"
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              padding: '8px 12px',
            }}
            formatter={(value: number, name: string, props: any) => {
              const lines = [
                `Score: ${value}%`,
              ];
              if (props.payload.checks > 0) {
                lines.push(`Checks: ${props.payload.checks}`);
              }
              if (props.payload.passed > 0) {
                lines.push(`Passed: ${props.payload.passed}`);
              }
              if (props.payload.failed > 0) {
                lines.push(`Failed: ${props.payload.failed}`);
              }
              return lines;
            }}
            labelFormatter={() => ''}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span className="text-gray-600">Excellent (&gt;90%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-600"></div>
          <span className="text-gray-600">Good (80-90%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500"></div>
          <span className="text-gray-600">Fair (70-80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-600"></div>
          <span className="text-gray-600">Needs Work (&lt;70%)</span>
        </div>
      </div>
    </div>
  );
}
