'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { RISK_COLORS } from '@/lib/analytics/colors';
import { formatNumber } from '@/lib/analytics/formatting';

interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

interface RiskDistributionChartProps {
  distribution: RiskDistribution;
  className?: string;
}

export function RiskDistributionChart({ distribution, className = '' }: RiskDistributionChartProps) {
  // Safety check for undefined distribution
  if (!distribution) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          Loading risk data...
        </div>
      </div>
    );
  }

  const data = [
    { name: 'Critical', value: distribution.critical || 0, color: RISK_COLORS.critical },
    { name: 'High', value: distribution.high || 0, color: RISK_COLORS.high },
    { name: 'Medium', value: distribution.medium || 0, color: RISK_COLORS.medium },
    { name: 'Low', value: distribution.low || 0, color: RISK_COLORS.low },
    { name: 'Info', value: distribution.info || 0, color: RISK_COLORS.info },
  ].filter(item => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No issues to display
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => formatNumber(value)}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              padding: '8px 12px',
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry) => {
              const entryValue = entry?.payload?.value;
              return entryValue !== undefined ? `${value}: ${formatNumber(entryValue)}` : String(value);
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-4 text-center">
        <div className="text-sm text-gray-600">Total Issues</div>
        <div className="text-2xl font-bold text-gray-900">{formatNumber(total)}</div>
      </div>
    </div>
  );
}
