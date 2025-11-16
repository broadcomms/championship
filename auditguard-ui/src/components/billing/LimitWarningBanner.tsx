/**
 * LimitWarningBanner Component
 * Shows warnings when approaching or hitting workspace limits
 * Phase 4.2: Upgrade Prompts
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';

interface LimitWarningBannerProps {
  workspaceId: string;
}

interface LimitData {
  documents: { used: number; limit: number };
  compliance_checks: { used: number; limit: number };
  ai_messages: { used: number; limit: number };
  storage_bytes: { used: number; limit: number };
  team_members: { used: number; limit: number };
}

type LimitType = 'documents' | 'compliance_checks' | 'ai_messages' | 'storage_bytes' | 'team_members';

interface LimitWarning {
  type: LimitType;
  percentage: number;
  used: number;
  limit: number;
  urgency: 'warning' | 'critical' | 'blocked';
}

const LIMIT_LABELS: Record<LimitType, string> = {
  documents: 'Documents',
  compliance_checks: 'Compliance Checks',
  ai_messages: 'AI Messages',
  storage_bytes: 'Storage',
  team_members: 'Team Members',
};

const LIMIT_ICONS: Record<LimitType, string> = {
  documents: '📄',
  compliance_checks: '✓',
  ai_messages: '💬',
  storage_bytes: '💾',
  team_members: '👥',
};

function formatStorage(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Calculate warning level based on usage percentage
 */
function getWarningLevel(percentage: number): 'warning' | 'critical' | 'blocked' | null {
  if (percentage >= 100) return 'blocked';
  if (percentage >= 90) return 'critical';
  if (percentage >= 70) return 'warning';
  return null;
}

/**
 * Banner component showing limit warnings
 */
export function LimitWarningBanner({ workspaceId }: LimitWarningBannerProps) {
  const [limits, setLimits] = useState<LimitData | null>(null);
  const [warnings, setWarnings] = useState<LimitWarning[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchLimits() {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/usage`);
        if (!response.ok) throw new Error('Failed to fetch limits');
        
        const data = await response.json();
        setLimits(data.limits);
        
        // Calculate warnings
        const newWarnings: LimitWarning[] = [];
        
        Object.entries(data.limits).forEach(([key, value]: [string, any]) => {
          const percentage = (value.used / value.limit) * 100;
          const level = getWarningLevel(percentage);
          
          if (level) {
            newWarnings.push({
              type: key as LimitType,
              percentage,
              used: value.used,
              limit: value.limit,
              urgency: level,
            });
          }
        });
        
        // Sort by urgency (blocked > critical > warning) then by percentage
        newWarnings.sort((a, b) => {
          const urgencyOrder = { blocked: 3, critical: 2, warning: 1 };
          if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
            return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
          }
          return b.percentage - a.percentage;
        });
        
        setWarnings(newWarnings);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching limits:', error);
        setLoading(false);
      }
    }

    fetchLimits();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchLimits, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const handleDismiss = (type: LimitType) => {
    setDismissed(new Set(dismissed).add(type));
  };

  const handleUpgrade = () => {
    router.push(`/workspaces/${workspaceId}/billing`);
  };

  if (loading || warnings.length === 0) return null;

  // Show the most urgent warning
  const topWarning = warnings.find(w => !dismissed.has(w.type));
  if (!topWarning) return null;

  const canDismiss = topWarning.urgency !== 'blocked';
  
  const bgColor = {
    warning: 'bg-amber-50 border-amber-200',
    critical: 'bg-orange-50 border-orange-300',
    blocked: 'bg-red-50 border-red-300',
  }[topWarning.urgency];

  const textColor = {
    warning: 'text-amber-900',
    critical: 'text-orange-900',
    blocked: 'text-red-900',
  }[topWarning.urgency];

  const iconColor = {
    warning: 'text-amber-600',
    critical: 'text-orange-600',
    blocked: 'text-red-600',
  }[topWarning.urgency];

  const buttonColor = {
    warning: 'bg-amber-600 hover:bg-amber-700',
    critical: 'bg-orange-600 hover:bg-orange-700',
    blocked: 'bg-red-600 hover:bg-red-700',
  }[topWarning.urgency];

  const displayValue = topWarning.type === 'storage_bytes' 
    ? `${formatStorage(topWarning.used)} / ${formatStorage(topWarning.limit)}`
    : `${topWarning.used} / ${topWarning.limit}`;

  const message = {
    warning: `You're using ${Math.round(topWarning.percentage)}% of your ${LIMIT_LABELS[topWarning.type].toLowerCase()} limit`,
    critical: `You're almost at your ${LIMIT_LABELS[topWarning.type].toLowerCase()} limit (${Math.round(topWarning.percentage)}%)`,
    blocked: `You've reached your ${LIMIT_LABELS[topWarning.type].toLowerCase()} limit!`,
  }[topWarning.urgency];

  return (
    <div className={`${bgColor} border-l-4 p-4 mb-4 rounded-r-lg shadow-sm`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className={`text-2xl ${iconColor}`}>
            {topWarning.urgency === 'blocked' ? '🚫' : topWarning.urgency === 'critical' ? '⚠️' : 'ℹ️'}
          </span>
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-semibold ${textColor}`}>
                {LIMIT_ICONS[topWarning.type]} {message}
              </h3>
              <div className="mt-1">
                <p className={`text-sm ${textColor} opacity-90`}>
                  {displayValue}
                </p>
                {topWarning.urgency === 'blocked' && (
                  <p className={`text-sm ${textColor} font-medium mt-1`}>
                    Upgrade now to continue using {LIMIT_LABELS[topWarning.type].toLowerCase()}.
                  </p>
                )}
              </div>
              
              {/* Progress bar */}
              <div className="mt-2 w-full bg-white rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    topWarning.urgency === 'blocked' ? 'bg-red-600' :
                    topWarning.urgency === 'critical' ? 'bg-orange-500' :
                    'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(topWarning.percentage, 100)}%` }}
                />
              </div>
              
              {/* Additional warnings count */}
              {warnings.length > 1 && (
                <p className={`text-xs ${textColor} opacity-75 mt-2`}>
                  +{warnings.length - 1} other limit{warnings.length > 2 ? 's' : ''} approaching
                </p>
              )}
            </div>
            
            <div className="ml-4 flex items-center space-x-2">
              <button
                onClick={handleUpgrade}
                className={`${buttonColor} text-white px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap`}
              >
                {topWarning.urgency === 'blocked' ? 'Upgrade Now' : 'View Plans'}
              </button>
              {canDismiss && (
                <button
                  onClick={() => handleDismiss(topWarning.type)}
                  className={`${textColor} hover:opacity-75 p-1`}
                  aria-label="Dismiss"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
