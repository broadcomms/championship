'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Subscription {
  tier: 'Free' | 'Professional' | 'Enterprise';
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_end?: number;
}

interface UsageMetrics {
  uploads_used: number;
  uploads_limit: number;
  checks_used: number;
  checks_limit: number;
  period_start: number;
  period_end: number;
}

interface Invoice {
  id: string;
  amount: number;
  status: 'paid' | 'open' | 'void';
  created_at: number;
  pdf_url: string;
}

interface PlanTier {
  name: string;
  price: number;
  uploads: number;
  checks: number;
  features: string[];
}

// Default plan tiers (will be replaced by API data)
const DEFAULT_PLAN_TIERS: Record<string, PlanTier> = {
  Free: {
    name: 'Free',
    price: 0,
    uploads: 10,
    checks: 20,
    features: [
      '10 document uploads total',
      '20 compliance checks/month',
      '3 workspaces',
      'Basic compliance frameworks',
      'Community support',
    ],
  },
  Starter: {
    name: 'Starter',
    price: 29,
    uploads: 10,
    checks: 50,
    features: [
      '10 document uploads',
      '50 compliance checks/month',
      '5 workspaces',
      'All compliance frameworks',
      'Email support',
    ],
  },
  Professional: {
    name: 'Professional',
    price: 99,
    uploads: 50,
    checks: 200,
    features: [
      '50 document uploads',
      '200 compliance checks/month',
      '20 workspaces',
      'All compliance frameworks',
      'Priority support',
      'Advanced analytics',
      'API access',
      'Slack integration',
      'Custom branding',
    ],
  },
  Business: {
    name: 'Business',
    price: 299,
    uploads: 1000,
    checks: 2000,
    features: [
      '1,000 document uploads',
      '2,000 compliance checks/month',
      '50 workspaces',
      'All frameworks',
      'Priority support',
      'Advanced analytics',
      'API access',
      'SSO',
      'Audit trails',
      'Custom frameworks',
    ],
  },
  Enterprise: {
    name: 'Enterprise',
    price: 1999,
    uploads: -1, // unlimited
    checks: -1, // unlimited
    features: [
      'Unlimited document uploads',
      'Unlimited compliance checks',
      'Unlimited workspaces',
      'All compliance frameworks',
      '24/7 premium support',
      'Advanced analytics & reporting',
      'API access',
      'SSO & advanced security',
      'Custom integrations',
      'Dedicated account manager',
    ],
  },
};

export default function OrganizationBillingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.id as string;
  const accountId = user?.userId;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch usage forecast (includes current usage + plan limits)
        // Note: api.get() returns data directly, not wrapped in .data property
        const forecast = await api.get(`/api/organizations/${orgId}/usage/forecast`);

        // Check if forecast data is valid
        if (forecast && typeof forecast === 'object' && forecast.current_usage && forecast.plan_limits) {
          // Map backend data structure to frontend expected format
          setUsage({
            uploads_used: forecast.current_usage?.documents || 0,
            uploads_limit: forecast.plan_limits?.max_documents || 10,
            checks_used: forecast.current_usage?.checks || 0,
            checks_limit: forecast.plan_limits?.max_checks || 5,
            period_start: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
            period_end: Date.now(),
          });
        } else {
          // No forecast data available, use defaults
          setUsage({
            uploads_used: 0,
            uploads_limit: 10,
            checks_used: 0,
            checks_limit: 5,
            period_start: Date.now() - 30 * 24 * 60 * 60 * 1000,
            period_end: Date.now(),
          });
        }

        // Set default subscription (Free tier) - subscription management not yet implemented
        setSubscription({
          tier: 'Free',
          status: 'active',
          current_period_start: Date.now() - 30 * 24 * 60 * 60 * 1000,
          current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
          cancel_at_period_end: false,
        });

        // Invoices not yet implemented
        setInvoices([]);
      } catch (error) {
        console.error('Failed to fetch billing data:', error);
        // Set defaults on error
        setSubscription({
          tier: 'Free',
          status: 'active',
          current_period_start: Date.now(),
          current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
          cancel_at_period_end: false,
        });
        setUsage({
          uploads_used: 0,
          uploads_limit: 10,
          checks_used: 0,
          checks_limit: 5,
          period_start: Date.now() - 30 * 24 * 60 * 60 * 1000,
          period_end: Date.now(),
        });
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId]);

  const handleUpgrade = async (tier: string) => {
    // Subscription upgrades not yet implemented
    alert('Subscription management is coming soon! Please contact support to upgrade your plan.');
  };

  const handleCancelSubscription = async () => {
    // Subscription management not yet implemented
    alert('Subscription management is coming soon! Please contact support to cancel your plan.');
  };

  if (loading) {
    return (
      <OrganizationLayout accountId={accountId} orgId={orgId}>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OrganizationLayout>
    );
  }

  const currentPlan = subscription ? DEFAULT_PLAN_TIERS[subscription.tier] : DEFAULT_PLAN_TIERS.Free;
  const usagePercentUploads = usage
    ? (usage.uploads_used / usage.uploads_limit) * 100
    : 0;
  const usagePercentChecks = usage
    ? (usage.checks_used / usage.checks_limit) * 100
    : 0;

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId}>
      <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Billing & Subscription
            </h1>
            <p className="text-gray-600">
              Manage your plan, usage, and payment methods
            </p>
          </div>

          {/* Current Plan */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Current Plan: {currentPlan.name}
                </h2>
                <p className="text-gray-600">
                  {subscription?.status === 'trialing' && subscription.trial_end
                    ? `Trial ends ${new Date(subscription.trial_end).toLocaleDateString()}`
                    : subscription?.cancel_at_period_end
                    ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : subscription?.current_period_end
                    ? `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : 'Free plan'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">
                  ${currentPlan.price}
                </div>
                <div className="text-sm text-gray-600">/month</div>
              </div>
            </div>

            {subscription?.cancel_at_period_end && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  Your subscription will be canceled at the end of the current billing period.
                  You will retain access until {new Date(subscription.current_period_end).toLocaleDateString()}.
                </p>
              </div>
            )}
          </div>

          {/* Usage Metrics */}
          {usage && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Usage This Month
              </h2>

              <div className="space-y-6">
                {/* Document Uploads */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Document Uploads
                    </span>
                    <span className="text-sm text-gray-600">
                      {usage.uploads_used} / {usage.uploads_limit === -1 ? '∞' : usage.uploads_limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        usagePercentUploads > 90
                          ? 'bg-red-600'
                          : usagePercentUploads > 75
                          ? 'bg-yellow-600'
                          : 'bg-blue-600'
                      }`}
                      style={{
                        width: `${Math.min(usagePercentUploads, 100)}%`,
                      }}
                    />
                  </div>
                  {usagePercentUploads > 75 && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ You're approaching your upload limit. Consider upgrading your plan.
                    </p>
                  )}
                </div>

                {/* Compliance Checks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Compliance Checks
                    </span>
                    <span className="text-sm text-gray-600">
                      {usage.checks_used} / {usage.checks_limit === -1 ? '∞' : usage.checks_limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        usagePercentChecks > 90
                          ? 'bg-red-600'
                          : usagePercentChecks > 75
                          ? 'bg-yellow-600'
                          : 'bg-green-600'
                      }`}
                      style={{
                        width: `${Math.min(usagePercentChecks, 100)}%`,
                      }}
                    />
                  </div>
                  {usagePercentChecks > 75 && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ You're approaching your check limit. Consider upgrading your plan.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Period: {new Date(usage.period_start).toLocaleDateString()} -{' '}
                {new Date(usage.period_end).toLocaleDateString()}
              </div>
            </div>
          )}

          {/* Plan Comparison */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Available Plans
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(DEFAULT_PLAN_TIERS).map(([tier, plan]) => {
                const isCurrent = subscription?.tier === tier;

                return (
                  <div
                    key={tier}
                    className={`rounded-lg border-2 p-6 ${
                      isCurrent
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    {isCurrent && (
                      <span className="inline-block px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full mb-4">
                        Current Plan
                      </span>
                    )}

                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {plan.name}
                    </h3>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-gray-900">
                        ${plan.price}
                      </span>
                      <span className="text-gray-600">/month</span>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {!isCurrent && (
                      <Button
                        onClick={() => handleUpgrade(tier)}
                        variant={tier === 'Enterprise' ? 'primary' : 'outline'}
                        className="w-full"
                      >
                        {tier === 'Free' ? 'Downgrade' : 'Upgrade'}
                      </Button>
                    )}

                    {isCurrent && !subscription?.cancel_at_period_end && tier !== 'Free' && (
                      <Button
                        onClick={handleCancelSubscription}
                        variant="outline"
                        className="w-full text-red-600 border-red-300 hover:bg-red-50"
                      >
                        Cancel Plan
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invoice History */}
          {invoices.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Invoice History
              </h2>
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        ${(invoice.amount / 100).toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'open'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {invoice.status}
                      </span>
                      {invoice.pdf_url && (
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Download PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </OrganizationLayout>
  );
}
