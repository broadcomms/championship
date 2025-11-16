/**
 * UpgradeBadge Component
 * Badge shown on locked features prompting users to upgrade
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import type { PlanId } from '@/utils/feature-gates';

interface UpgradeBadgeProps {
  requiredPlan: PlanId;
  isTrial?: boolean;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
}

const planNames: Record<PlanId, string> = {
  plan_free: 'Free',
  plan_starter: 'Starter',
  plan_professional: 'Professional',
  plan_business: 'Business',
  plan_enterprise: 'Enterprise',
};

const planColors: Record<PlanId, string> = {
  plan_free: 'bg-gray-500',
  plan_starter: 'bg-blue-500',
  plan_professional: 'bg-purple-500',
  plan_business: 'bg-orange-500',
  plan_enterprise: 'bg-red-500',
};

/**
 * Badge component for locked features
 */
export function UpgradeBadge({
  requiredPlan,
  isTrial = false,
  onClick,
  size = 'medium',
}: UpgradeBadgeProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default: navigate to billing page
      router.push('/billing');
    }
  };

  const sizeClasses = {
    small: 'text-xs px-3 py-1',
    medium: 'text-sm px-4 py-2',
    large: 'text-base px-6 py-3',
  };

  const iconSize = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5',
  };

  return (
    <div
      className={`
        inline-flex items-center gap-2 rounded-lg 
        ${planColors[requiredPlan]} text-white 
        ${sizeClasses[size]} 
        cursor-pointer hover:opacity-90 transition-opacity
        shadow-lg
      `}
      onClick={handleClick}
    >
      <svg
        className={iconSize[size]}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <span className="font-semibold">
        {isTrial ? 'Trial Feature' : `${planNames[requiredPlan]} Feature`}
      </span>
      <span className="opacity-75">·</span>
      <span className="underline">Upgrade</span>
    </div>
  );
}

/**
 * Inline badge for smaller UI elements (buttons, menu items)
 */
export function InlineUpgradeBadge({ requiredPlan }: { requiredPlan: PlanId }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
        ${planColors[requiredPlan]} text-white
      `}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
          clipRule="evenodd"
        />
      </svg>
      {planNames[requiredPlan]}
    </span>
  );
}

/**
 * Feature lock overlay for sections
 */
export function FeatureLockOverlay({
  requiredPlan,
  isTrial,
  featureName,
  onUpgrade,
}: {
  requiredPlan: PlanId;
  isTrial?: boolean;
  featureName: string;
  onUpgrade?: () => void;
}) {
  return (
    <div className="text-center p-8 bg-white rounded-lg shadow-lg border-2 border-gray-200">
      <div className="mb-4">
        <svg
          className="w-16 h-16 mx-auto text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {featureName} is Locked
      </h3>
      <p className="text-gray-600 mb-6">
        {isTrial
          ? `This feature is available during your trial. Upgrade to ${planNames[requiredPlan]} to continue using it after your trial ends.`
          : `Upgrade to ${planNames[requiredPlan]} plan or higher to unlock this feature.`}
      </p>
      <Button onClick={onUpgrade}>
        Upgrade to {planNames[requiredPlan]}
      </Button>
    </div>
  );
}
