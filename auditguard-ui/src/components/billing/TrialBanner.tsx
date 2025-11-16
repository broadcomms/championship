'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/common/Button';

interface TrialStatus {
  isTrialing: boolean;
  trialStart: number | null;
  trialEnd: number | null;
  daysRemaining: number | null;
  currentPlan: string;
}

interface TrialBannerProps {
  workspaceId: string;
  onUpgrade?: () => void;
}

export function TrialBanner({ workspaceId, onUpgrade }: TrialBannerProps) {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function fetchTrialStatus() {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/trial-status`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setTrialStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch trial status:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTrialStatus();
    
    // Refresh trial status every hour
    const interval = setInterval(fetchTrialStatus, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [workspaceId]);

  // Don't show banner if:
  // - Loading
  // - User dismissed it
  // - Not trialing
  // - Trial status not available
  if (loading || dismissed || !trialStatus || !trialStatus.isTrialing) {
    return null;
  }

  const daysRemaining = trialStatus.daysRemaining || 0;
  const trialEndDate = trialStatus.trialEnd 
    ? new Date(trialStatus.trialEnd).toLocaleDateString()
    : 'Unknown';

  // Determine urgency level for styling
  const isUrgent = daysRemaining <= 3;
  const isWarning = daysRemaining > 3 && daysRemaining <= 7;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Default: navigate to billing page
      window.location.href = `/workspaces/${workspaceId}/billing`;
    }
  };

  return (
    <div 
      className={`
        rounded-lg border-l-4 p-4 shadow-sm relative
        ${isUrgent ? 'bg-red-50 border-red-500 dark:bg-red-950/20' : ''}
        ${isWarning ? 'bg-amber-50 border-amber-500 dark:bg-amber-950/20' : ''}
        ${!isUrgent && !isWarning ? 'bg-blue-50 border-blue-500 dark:bg-blue-950/20' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <Sparkles 
          className={`
            h-5 w-5 mt-0.5 flex-shrink-0
            ${isUrgent ? 'text-red-600' : ''}
            ${isWarning ? 'text-amber-600' : ''}
            ${!isUrgent && !isWarning ? 'text-blue-600' : ''}
          `}
        />
        
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium">
            {isUrgent && (
              <span className="text-red-900 dark:text-red-100">
                ⚠️ Your Professional trial ends in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}!
              </span>
            )}
            {isWarning && (
              <span className="text-amber-900 dark:text-amber-100">
                Your Professional trial ends in {daysRemaining} days ({trialEndDate})
              </span>
            )}
            {!isUrgent && !isWarning && (
              <span className="text-blue-900 dark:text-blue-100">
                You&apos;re on a Professional trial - {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </span>
            )}
          </div>
          
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {isUrgent ? (
              <>
                Upgrade now to keep unlimited documents, advanced analytics, team collaboration, and priority support.
              </>
            ) : (
              <>
                Enjoying Professional features? Upgrade before {trialEndDate} to keep them after your trial ends.
              </>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant={isUrgent ? 'danger' : 'primary'}
              onClick={handleUpgrade}
              className="gap-1"
            >
              {isUrgent ? 'Upgrade Now' : 'View Plans'}
              <ArrowRight className="h-3 w-3" />
            </Button>
            
            {!isUrgent && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDismissed(true)}
              >
                Remind me later
              </Button>
            )}
          </div>
        </div>

        {/* Dismiss button - only show if not urgent */}
        {!isUrgent && (
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
