'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SubscriptionPlan } from '@/types';
import Link from 'next/link';

interface PricingTableProps {
  workspaceId: string;
  currentPlanId?: string;
  onSelectPlan?: (planId: string) => void;
}

export function PricingTable({ workspaceId, currentPlanId, onSelectPlan }: PricingTableProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await api.get<{ plans?: SubscriptionPlan[] }>('/api/billing/plans');
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const calculateSavings = (monthly: number, yearly: number) => {
    if (monthly === 0 || yearly === 0) return null;
    const monthlyCost = monthly * 12;
    const savings = monthlyCost - yearly;
    if (savings <= 0) return null;
    const percentage = (savings / monthlyCost) * 100;
    return { amount: savings, percentage };
  };

  return (
    <div className="space-y-8">
      {/* Billing Period Toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
              billingPeriod === 'yearly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((plan) => {
          const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceYearly;
          const savings = calculateSavings(plan.priceMonthly, plan.priceYearly);
          const isCurrentPlan = plan.id === currentPlanId;
          const isFree = plan.priceMonthly === 0;
          const isPopular = plan.name === 'professional' || plan.name === 'pro';

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border ${
                isPopular
                  ? 'border-blue-500 shadow-xl ring-2 ring-blue-500'
                  : 'border-gray-200 shadow-sm'
              } bg-white p-8 flex flex-col`}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="flex-1">
                {/* Plan Name */}
                <h3 className="text-xl font-semibold text-gray-900">{plan.displayName}</h3>
                <p className="mt-2 text-sm text-gray-600">{plan.description}</p>

                {/* Price */}
                <p className="mt-6">
                  <span className="text-4xl font-bold tracking-tight text-gray-900">
                    {formatPrice(price)}
                  </span>
                  {!isFree && (
                    <span className="text-base font-medium text-gray-600">
                      /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  )}
                </p>

                {/* Savings Badge */}
                {billingPeriod === 'yearly' && savings && (
                  <p className="mt-2 text-sm text-green-600 font-medium">
                    Save ${(savings.amount / 100).toFixed(0)}/year ({savings.percentage.toFixed(0)}%)
                  </p>
                )}

                {/* Features List */}
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
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
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Key Limits */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    Plan Limits
                  </p>
                  <ul className="mt-3 space-y-2">
                    <li className="text-sm text-gray-600">
                      <span className="font-medium">Documents:</span>{' '}
                      {plan.limits.documents === -1 ? 'Unlimited' : plan.limits.documents.toLocaleString()}
                    </li>
                    <li className="text-sm text-gray-600">
                      <span className="font-medium">Compliance Checks:</span>{' '}
                      {plan.limits.compliance_checks === -1
                        ? 'Unlimited'
                        : plan.limits.compliance_checks.toLocaleString()}
                    </li>
                    <li className="text-sm text-gray-600">
                      <span className="font-medium">AI Messages:</span>{' '}
                      {plan.limits.assistant_messages === -1
                        ? 'Unlimited'
                        : plan.limits.assistant_messages.toLocaleString()}
                    </li>
                  </ul>
                </div>
              </div>

              {/* CTA Button */}
              <div className="mt-8">
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full px-4 py-3 text-sm font-semibold text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : isFree ? (
                  <button
                    disabled
                    className="w-full px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-300 rounded-lg"
                  >
                    Free Forever
                  </button>
                ) : onSelectPlan ? (
                  <button
                    onClick={() => onSelectPlan(plan.id)}
                    className={`w-full px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
                      isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {currentPlanId ? 'Switch to this plan' : 'Get Started'}
                  </button>
                ) : (
                  <Link
                    href={`/workspaces/${workspaceId}/billing/checkout?plan=${plan.id}`}
                    className={`block w-full px-4 py-3 text-sm font-semibold text-center rounded-lg transition-colors ${
                      isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {currentPlanId ? 'Switch to this plan' : 'Get Started'}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ or Additional Info */}
      <div className="mt-12 text-center">
        <p className="text-sm text-gray-600">
          All plans include 24/7 email support. Need help choosing?{' '}
          <a href="/contact" className="font-medium text-blue-600 hover:text-blue-500">
            Contact our sales team
          </a>
        </p>
      </div>
    </div>
  );
}
