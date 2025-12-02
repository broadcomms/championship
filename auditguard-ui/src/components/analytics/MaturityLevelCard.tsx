'use client';

interface MaturityLevel {
  level: number;
  name: string;
  characteristics: string[];
  nextSteps?: string[];
  progress?: number;
}

interface MaturityLevelCardProps {
  maturity: MaturityLevel;
  className?: string;
}

const LEVEL_COLORS = {
  1: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-800' },
  2: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800' },
  3: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800' },
  4: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  5: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-100 text-green-800' },
};

export function MaturityLevelCard({ maturity, className = '' }: MaturityLevelCardProps) {
  const colors = LEVEL_COLORS[maturity.level as keyof typeof LEVEL_COLORS] || LEVEL_COLORS[3];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">CMMI Maturity Level</h3>
          <p className="text-sm text-gray-600">
            Capability Maturity Model Integration assessment
          </p>
        </div>
        
        <div className={`flex items-center justify-center w-16 h-16 rounded-full ${colors.bg} ${colors.border} border-2`}>
          <span className={`text-3xl font-bold ${colors.text}`}>{maturity.level}</span>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors.badge}`}>
            {maturity.name}
          </span>
          {maturity.progress !== undefined && (
            <span className="text-sm text-gray-600">{maturity.progress}% complete</span>
          )}
        </div>
        
        {maturity.progress !== undefined && (
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${colors.text.replace('text-', 'bg-')}`}
              style={{ width: `${maturity.progress}%` }}
            />
          </div>
        )}
      </div>

      {maturity.characteristics && maturity.characteristics.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Key Characteristics</h4>
          <ul className="space-y-2">
            {maturity.characteristics.map((characteristic, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{characteristic}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {maturity.nextSteps && maturity.nextSteps.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Next Steps to Improve</h4>
          <ul className="space-y-2">
            {maturity.nextSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-500 mt-0.5">→</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Level {maturity.level} of 5</span>
          <span className="font-medium">
            {maturity.level === 5 ? 'Optimizing' : `${5 - maturity.level} levels to go`}
          </span>
        </div>
      </div>
    </div>
  );
}
