'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS } from '@/lib/analytics/colors';
import { formatDate } from '@/lib/analytics/formatting';

interface TrendDataPoint {
  date: string;
  score: number;
  framework?: string;
}

interface ComplianceTrendChartProps {
  data: TrendDataPoint[];
  className?: string;
}

export function ComplianceTrendChart({ data, className = '' }: ComplianceTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Trend</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No trend data available
        </div>
      </div>
    );
  }

  // Group data by framework if multiple frameworks exist
  const frameworks = [...new Set(data.map(d => d.framework || 'Overall'))];
  const chartData = data.map(point => ({
    date: formatDate(point.date, 'MMM d'),
    dateValue: new Date(point.date).getTime(),
    score: point.score,
    framework: point.framework || 'Overall'
  }));

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Trend</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
          />
          <YAxis 
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
            label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6B7280' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              padding: '8px 12px',
            }}
            formatter={(value: number) => [`${value}%`, 'Score']}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="score"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorScore)"
            name="Compliance Score"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-600">Target: 80%</span>
        </div>
        {data.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-gray-600">Current: {data[data.length - 1].score}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
