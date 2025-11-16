'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { Check, X } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: Record<string, number>;
}

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.get<{ plans: Plan[] }>('/api/plans');
      setPlans(response.plans.sort((a, b) => a.priceMonthly - b.priceMonthly));
    } catch (err: any) {
      setError(err.error || 'Failed to load pricing plans');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (cents: number): string => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const getFeatureDisplay = (value: number): string => {
    if (value === -1) return 'Unlimited';
    if (value === 0) return 'Not included';
    return value.toString();
  };

  const isPlanRecommended = (planName: string): boolean => {
    return planName === 'professional';
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading pricing...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPlans}
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Choose the perfect plan for your compliance needs
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-md font-medium ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-md font-medium ${
                billingCycle === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {plans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
            const isRecommended = isPlanRecommended(plan.name);

            return (
              <div
                key={plan.id}
                className={`rounded-lg border-2 bg-white p-8 shadow-lg relative ${
                  isRecommended
                    ? 'border-blue-600 ring-4 ring-blue-100'
                    : 'border-gray-200'
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">{plan.displayName}</h3>
                  {plan.description && (
                    <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
                  )}
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-bold text-gray-900">
                      {formatPrice(price)}
                    </span>
                    <span className="ml-2 text-gray-600">
                      /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && price > 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      ${(price / 100 / 12).toFixed(2)}/mo billed annually
                    </p>
                  )}
                </div>

                <Button
                  variant={isRecommended ? 'primary' : 'outline'}
                  className="w-full mb-6"
                  onClick={() => router.push('/register')}
                >
                  {plan.name === 'free' ? 'Get Started' : 'Start Free Trial'}
                </Button>

                <div className="space-y-4">
                  <div className="text-sm font-semibold text-gray-900 border-b pb-2">
                    What's included:
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">
                        <strong>{getFeatureDisplay(plan.limits.max_workspaces)}</strong> Workspaces
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">
                        <strong>{getFeatureDisplay(plan.limits.max_documents)}</strong> Documents
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">
                        <strong>{getFeatureDisplay(plan.limits.max_checks)}</strong> Compliance Checks/mo
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">
                        <strong>{getFeatureDisplay(plan.limits.max_storage_gb)}</strong> GB Storage
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      {plan.features.includes('ai_analysis') ? (
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={plan.features.includes('ai_analysis') ? 'text-gray-700' : 'text-gray-400'}>
                        AI-Powered Analysis
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      {plan.features.includes('advanced_analytics') ? (
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={plan.features.includes('advanced_analytics') ? 'text-gray-700' : 'text-gray-400'}>
                        Advanced Analytics
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      {plan.features.includes('api_access') ? (
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={plan.features.includes('api_access') ? 'text-gray-700' : 'text-gray-400'}>
                        API Access
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      {plan.features.includes('sso') ? (
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={plan.features.includes('sso') ? 'text-gray-700' : 'text-gray-400'}>
                        SSO Integration
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      {plan.features.includes('priority_support') ? (
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={plan.features.includes('priority_support') ? 'text-gray-700' : 'text-gray-400'}>
                        Priority Support
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ / Additional Info */}
        <div className="border-t border-gray-200 pt-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I change plans later?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                Yes! All paid plans come with a 14-day free trial. No credit card required to start.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards (Visa, MasterCard, Amex) through Stripe.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-600">
                Absolutely. You can cancel your subscription at any time with no penalties or fees.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to get started?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Start your 14-day free trial today. No credit card required.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/register')}
          >
            Start Free Trial
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
