/**
 * UpgradeModal Component
 * Modal showing upgrade options with value propositions
 * Phase 4.2: Upgrade Prompts
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanId } from '@/utils/feature-gates';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: PlanId;
  workspaceId: string;
  reason?: 'limit' | 'feature' | 'trial_ending' | 'general';
  limitType?: string;
  featureName?: string;
}

interface PlanOption {
  id: PlanId;
  name: string;
  price: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  popular?: boolean;
  cta: string;
}

const PLANS: PlanOption[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    price: 49,
    yearlyPrice: 470,
    description: 'Perfect for solo consultants',
    features: [
      '50 documents',
      '100 compliance checks/month',
      '5 workspaces',
      'All compliance frameworks',
      'Email support (48h)',
      'Export to PDF',
    ],
    cta: 'Start with Starter',
  },
  {
    id: 'plan_professional',
    name: 'Professional',
    price: 149,
    yearlyPrice: 1430,
    description: 'For growing teams',
    features: [
      '1,000 documents',
      '1,000 compliance checks/month',
      '20 workspaces',
      'Advanced analytics',
      'Team collaboration',
      'API access',
      'Slack integration',
      'Priority support (24h)',
      'Custom branding',
    ],
    popular: true,
    cta: 'Go Professional',
  },
  {
    id: 'plan_business',
    name: 'Business',
    price: 399,
    yearlyPrice: 3830,
    description: 'For established companies',
    features: [
      '5,000 documents',
      '10,000 compliance checks/month',
      '50 workspaces',
      'Everything in Professional, plus:',
      'SSO (SAML/OIDC)',
      'Custom frameworks',
      'Audit logs',
      'Advanced permissions',
      'Dedicated account manager',
      'SLA guarantees',
    ],
    cta: 'Get Business',
  },
];

export function UpgradeModal({
  isOpen,
  onClose,
  currentPlan,
  workspaceId,
  reason = 'general',
  limitType,
  featureName,
}: UpgradeModalProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgrade = (planId: PlanId) => {
    router.push(`/workspaces/${workspaceId}/billing?upgrade=${planId}&cycle=${billingCycle}`);
    onClose();
  };

  // Filter plans to show only upgrades
  const availablePlans = PLANS.filter(plan => {
    const planOrder: PlanId[] = ['plan_free', 'plan_starter', 'plan_professional', 'plan_business', 'plan_enterprise'];
    return planOrder.indexOf(plan.id) > planOrder.indexOf(currentPlan);
  });

  // Get title based on reason
  const getTitle = () => {
    switch (reason) {
      case 'limit':
        return `You've Hit Your ${limitType || 'Limit'}`;
      case 'feature':
        return `Unlock ${featureName || 'Premium Features'}`;
      case 'trial_ending':
        return 'Your Trial is Ending Soon';
      default:
        return 'Upgrade Your Plan';
    }
  };

  // Get description based on reason
  const getDescription = () => {
    switch (reason) {
      case 'limit':
        return `Upgrade to get more ${limitType?.toLowerCase() || 'capacity'} and unlock advanced features.`;
      case 'feature':
        return `${featureName} is available on higher plans. Choose a plan below to unlock it.`;
      case 'trial_ending':
        return 'Continue enjoying Professional features by upgrading today. Save 20% with annual billing!';
      default:
        return 'Choose the plan that fits your needs. All plans include a 30-day money-back guarantee.';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b">
            <h2 className="text-3xl font-bold text-gray-900">{getTitle()}</h2>
            <p className="mt-2 text-gray-600">{getDescription()}</p>
            
            {/* Billing cycle toggle */}
            <div className="mt-6 flex items-center justify-center space-x-3">
              <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  billingCycle === 'yearly' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Yearly
              </span>
              {billingCycle === 'yearly' && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Save 20%
                </span>
              )}
            </div>
          </div>

          {/* Plans grid */}
          <div className="px-8 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availablePlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-lg border-2 p-6 ${
                    plan.popular
                      ? 'border-blue-600 shadow-lg'
                      : 'border-gray-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-blue-600 text-white">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
                    
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-gray-900">
                        ${billingCycle === 'monthly' ? plan.price : Math.round(plan.yearlyPrice / 12)}
                      </span>
                      <span className="text-gray-600">/month</span>
                    </div>
                    
                    {billingCycle === 'yearly' && (
                      <p className="mt-1 text-sm text-gray-500">
                        Billed ${plan.yearlyPrice} annually
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    className={`mt-6 w-full py-3 px-4 rounded-md font-semibold transition-colors ${
                      plan.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {plan.cta}
                  </button>
                  
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-sm">
                        <svg
                          className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-gray-50 border-t">
            <div className="text-center">
              <p className="text-sm text-gray-600">
                All plans include 30-day money-back guarantee • Cancel anytime • No hidden fees
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Need more? <a href="#" className="text-blue-600 hover:underline font-medium">Contact us for Enterprise pricing</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
