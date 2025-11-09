'use client';

import React from 'react';

/**
 * Compliance Score Gauge Component
 *
 * Displays a circular gauge chart for compliance scores (0-100)
 * with color-coded indicators and labels.
 *
 * Features:
 * - Color-coded by score (Red: 0-40, Orange: 41-60, Yellow: 61-80, Green: 81-100)
 * - Animated transitions
 * - Responsive sizing
 * - Accessible with ARIA labels
 *
 * @example
 * <ComplianceScoreGauge score={72} size="medium" />
 */

export interface ComplianceScoreGaugeProps {
  /** Score value from 0 to 100 */
  score: number;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Optional class name for custom styling */
  className?: string;
  /** Show label below gauge */
  showLabel?: boolean;
}

/**
 * Get color based on score
 */
function getScoreColor(score: number): string {
  if (score >= 81) return '#10b981'; // green-500
  if (score >= 61) return '#f59e0b'; // amber-500
  if (score >= 41) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

/**
 * Get label based on score
 */
function getScoreLabel(score: number): string {
  if (score >= 91) return 'Excellent';
  if (score >= 76) return 'Good';
  if (score >= 61) return 'Fair';
  if (score >= 41) return 'Poor';
  return 'Critical';
}

/**
 * Get risk level for ARIA label
 */
function getRiskLevel(score: number): string {
  if (score >= 81) return 'low risk';
  if (score >= 61) return 'medium risk';
  if (score >= 41) return 'high risk';
  return 'critical risk';
}

export function ComplianceScoreGauge({
  score,
  size = 'medium',
  className = '',
  showLabel = true,
}: ComplianceScoreGaugeProps) {
  // Ensure score is within valid range
  const normalizedScore = Math.min(100, Math.max(0, score));

  // Size configurations
  const sizes = {
    small: { width: 120, height: 120, fontSize: '1.5rem', strokeWidth: 10 },
    medium: { width: 180, height: 180, fontSize: '2.5rem', strokeWidth: 12 },
    large: { width: 240, height: 240, fontSize: '3.5rem', strokeWidth: 14 },
  };

  const { width, height, fontSize, strokeWidth } = sizes[size];
  const color = getScoreColor(normalizedScore);
  const label = getScoreLabel(normalizedScore);
  const riskLevel = getRiskLevel(normalizedScore);

  // Calculate circle properties
  const radius = (Math.min(width, height) / 2) - (strokeWidth + 5);
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedScore / 100) * circumference;
  const center = width / 2;

  return (
    <div
      className={`flex flex-col items-center ${className}`}
      role="meter"
      aria-valuenow={normalizedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Compliance score: ${normalizedScore} out of 100, ${riskLevel}`}
    >
      <svg
        width={width}
        height={height}
        className="transform -rotate-90"
        aria-hidden="true"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle with animation */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            transformOrigin: 'center',
          }}
        />

        {/* Center text */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy=".3em"
          className="transform rotate-90"
          style={{
            fontSize,
            fontWeight: 'bold',
            fill: color,
            transformOrigin: 'center',
          }}
        >
          {Math.round(normalizedScore)}
        </text>
      </svg>

      {showLabel && (
        <div className="mt-2 text-center">
          <div
            className="text-lg font-semibold"
            style={{ color }}
          >
            {label}
          </div>
          <div className="text-sm text-gray-500">
            Compliance Score
          </div>
        </div>
      )}
    </div>
  );
}

export default ComplianceScoreGauge;
