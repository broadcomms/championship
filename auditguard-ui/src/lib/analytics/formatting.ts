/**
 * Formatting utilities for analytics data
 */

import { format, formatDistanceToNow, isValid } from 'date-fns';

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a date for display
 */
export function formatDate(date: string | Date, formatStr: string = 'MMM d, yyyy'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(dateObj)) return 'Invalid date';
  return format(dateObj, formatStr);
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(dateObj)) return 'Unknown';
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Format a score with color class
 */
export function getScoreClass(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 80) return 'text-blue-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Format risk level for display
 */
export function formatRiskLevel(risk: string): string {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

/**
 * Get risk badge classes
 */
export function getRiskBadgeClass(risk: string): string {
  const baseClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  
  switch (risk.toLowerCase()) {
    case 'critical':
      return `${baseClass} bg-red-100 text-red-800`;
    case 'high':
      return `${baseClass} bg-orange-100 text-orange-800`;
    case 'medium':
      return `${baseClass} bg-yellow-100 text-yellow-800`;
    case 'low':
      return `${baseClass} bg-blue-100 text-blue-800`;
    case 'minimal':
      return `${baseClass} bg-green-100 text-green-800`;
    default:
      return `${baseClass} bg-gray-100 text-gray-800`;
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}
