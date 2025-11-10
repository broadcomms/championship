'use client';

interface ComplianceScoreGaugeProps {
  score: number; // 0-100
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  animated?: boolean;
}

export function ComplianceScoreGauge({
  score,
  size = 'medium',
  showLabel = true,
  animated = true,
}: ComplianceScoreGaugeProps) {
  // Clamp score between 0-100
  const clampedScore = Math.max(0, Math.min(100, score));
  
  // Calculate color based on score
  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981'; // green-500
    if (score >= 60) return '#3b82f6'; // blue-500
    if (score >= 40) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };

  // Calculate status text
  const getScoreStatus = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  // Size configurations
  const sizeConfig = {
    small: {
      width: 120,
      height: 80,
      radius: 50,
      strokeWidth: 8,
      fontSize: '1.5rem',
      labelFontSize: '0.75rem',
    },
    medium: {
      width: 180,
      height: 120,
      radius: 75,
      strokeWidth: 12,
      fontSize: '2rem',
      labelFontSize: '0.875rem',
    },
    large: {
      width: 240,
      height: 160,
      radius: 100,
      strokeWidth: 16,
      fontSize: '2.5rem',
      labelFontSize: '1rem',
    },
  };

  const config = sizeConfig[size];
  const circumference = Math.PI * config.radius;
  const offset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={`M ${config.strokeWidth / 2} ${config.height - config.strokeWidth / 2}
             A ${config.radius} ${config.radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.height - config.strokeWidth / 2}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Score arc */}
        <path
          d={`M ${config.strokeWidth / 2} ${config.height - config.strokeWidth / 2}
             A ${config.radius} ${config.radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.height - config.strokeWidth / 2}`}
          fill="none"
          stroke={getScoreColor(clampedScore)}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={animated ? 'transition-all duration-1000 ease-out' : ''}
          style={{
            transformOrigin: 'center',
          }}
        />

        {/* Score text */}
        <text
          x={config.width / 2}
          y={config.height - config.strokeWidth - 10}
          textAnchor="middle"
          className="font-bold"
          style={{
            fontSize: config.fontSize,
            fill: getScoreColor(clampedScore),
          }}
        >
          {Math.round(clampedScore)}
        </text>
      </svg>

      {showLabel && (
        <div className="mt-2 text-center">
          <div
            className="font-medium"
            style={{
              fontSize: config.labelFontSize,
              color: getScoreColor(clampedScore),
            }}
          >
            {getScoreStatus(clampedScore)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Compliance Score</div>
        </div>
      )}
    </div>
  );
}
