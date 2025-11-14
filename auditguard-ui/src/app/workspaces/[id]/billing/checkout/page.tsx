'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { CheckoutForm } from '@/components/billing/CheckoutForm';
import { StripeProvider } from '@/contexts/StripeProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import Link from 'next/link';

interface CheckoutPageProps {
  params: {
    id: string;
  };
}

interface PlanDetails {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
}

export default function CheckoutPage({ params }: CheckoutPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan');
  const billingPeriod = (searchParams.get('period') || 'monthly') as 'monthly' | 'yearly';

  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) {
      setError('No plan selected');
      setLoading(false);
      return;
    }

    loadPlan();
  }, [planId]);

  const loadPlan = async () => {
    try {
      setLoading(true);
      const data = await api.get('/billing/plans');
      const selectedPlan = data.plans?.find((p: PlanDetails) => p.id === planId);

      if (!selectedPlan) {
        setError('Plan not found');
        return;
      }

      setPlan(selectedPlan);
      setError(null);
    } catch (err) {
      setError('Failed to load plan details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    router.push(`/workspaces/${params.id}/billing?success=true`);
  };

  const handleCancel = () => {
    router.push(`/workspaces/${params.id}/billing/upgrade`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !plan) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <svg
                className="h-5 w-5 text-red-400 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
                <div className="mt-2">
                  <Link
                    href={`/workspaces/${params.id}/billing/upgrade`}
                    className="text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    Return to plan selection
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceYearly;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/workspaces/${params.id}/billing/upgrade`}
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 mb-4"
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Plans
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Complete Your Subscription</h1>
        <p className="mt-2 text-sm text-gray-600">
          Subscribe to {plan.displayName} and unlock powerful compliance features.
        </p>
      </div>

      {/* Plan Summary Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{plan.displayName}</h2>
            <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">
              ${(price / 100).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600">per {billingPeriod === 'monthly' ? 'month' : 'year'}</p>
          </div>
        </div>
      </div>

      {/* Checkout Form */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <StripeProvider>
          <CheckoutForm
            workspaceId={params.id}
            planId={plan.id}
            planName={plan.displayName}
            price={price}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </StripeProvider>
      </div>
    </div>
    </AppLayout>
  );
}
