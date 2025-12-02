/**
 * Color utilities for analytics charts and visualizations
 */

export const RISK_COLORS = {
  critical: '#DC2626', // red-600
  high: '#EA580C',     // orange-600
  medium: '#F59E0B',   // amber-500
  low: '#3B82F6',      // blue-500
  info: '#6B7280',     // gray-500
  minimal: '#10B981',  // green-500
} as const;

export const CHART_COLORS = {
  primary: '#2563EB',   // blue-600
  secondary: '#7C3AED', // violet-600
  success: '#10B981',   // green-500
  warning: '#F59E0B',   // amber-500
  danger: '#DC2626',    // red-600
  info: '#06B6D4',      // cyan-500
} as const;

export const FRAMEWORK_COLORS = [
  '#2563EB', // blue-600
  '#7C3AED', // violet-600
  '#EC4899', // pink-500
  '#10B981', // green-500
  '#F59E0B', // amber-500
  '#06B6D4', // cyan-500
  '#8B5CF6', // purple-500
  '#F97316', // orange-500
] as const;

export function getRiskColor(riskLevel: string): string {
  return RISK_COLORS[riskLevel as keyof typeof RISK_COLORS] || RISK_COLORS.info;
}

export function getScoreColor(score: number): string {
  if (score >= 90) return CHART_COLORS.success;
  if (score >= 80) return CHART_COLORS.primary;
  if (score >= 70) return CHART_COLORS.warning;
  return CHART_COLORS.danger;
}

export function getFrameworkColor(index: number): string {
  return FRAMEWORK_COLORS[index % FRAMEWORK_COLORS.length];
}
