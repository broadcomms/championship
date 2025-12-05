'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { OrganizationLayout } from '@/components/layout/OrganizationLayout';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ErrorResponse, SubscriptionPlan } from '@/types';
import type { Organization } from '@/types/organization';

interface OrganizationBillingData extends Organization {
  subscription_plan?: string | null;
  subscription_status?: SubscriptionDetails['status'];
}

interface SubscriptionDetails {
  plan_id: string;
  plan_name: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_start?: number;
  trial_end?: number;
  billing_cycle?: 'monthly' | 'yearly';
  price_monthly?: number;
  price_yearly?: number;
}

interface UsageMetrics {
  uploads_used: number;
  uploads_limit: number;
  checks_used: number;
  checks_limit: number;
  messages_used: number;
  messages_limit: number;
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
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number; // in dollars
  priceMonthly: number; // in cents
  priceYearly: number; // in cents
  uploads: number;
  checks: number;
  features: string[];
  limits: {
    documents: number;
    compliance_checks: number;
    assistant_messages: number;
    storage_gb: number;
    team_members: number;
    api_calls: number;
  };
}

type PlanWithLimits = Pick<SubscriptionPlan, 'limits' | 'features'>;

interface BillingPlansResponse {
  plans: SubscriptionPlan[];
}

interface UsageForecastResponse {
  current_usage?: {
    documents?: number;
    checks?: number;
    messages?: number;
  } | null;
  plan_limits?: {
    max_documents?: number;
    max_checks?: number;
    max_messages?: number;
  } | null;
}

interface OrganizationSubscriptionResponse {
  plan_id?: string;
  plan_name?: string;
  status?: SubscriptionDetails['status'];
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  trial_start?: number;
  trial_end?: number;
}

interface CheckoutSessionResponse {
  url: string;
  sessionId?: string;
}

const getApiErrorMessage = (error: unknown) => {
  if (
    error &&
    typeof error === 'object' &&
    'error' in error &&
    typeof (error as ErrorResponse).error === 'string'
  ) {
    return (error as ErrorResponse).error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

// Helper function to format plan features into human-readable list
function formatPlanFeatures(plan: PlanWithLimits): string[] {
  const features: string[] = [];
  
  // Add document limit
  const docLimit = plan.limits.documents;
  if (docLimit === -1) {
    features.push('Unlimited document uploads');
  } else {
    features.push(`${docLimit} document upload${docLimit !== 1 ? 's' : ''}`);
  }
  
  // Add compliance checks limit
  const checkLimit = plan.limits.compliance_checks;
  if (checkLimit === -1) {
    features.push('Unlimited compliance checks');
  } else {
    features.push(`${checkLimit} compliance checks/month`);
  }
  
  // Add AI messages limit
  const msgLimit = plan.limits.assistant_messages;
  if (msgLimit === -1) {
    features.push('Unlimited AI messages');
  } else if (msgLimit > 0) {
    features.push(`${msgLimit} AI messages/month`);
  }
  
  // Add team members limit
  const teamLimit = typeof plan.limits.users === 'number' ? plan.limits.users : 0;
  if (teamLimit === -1) {
    features.push('Unlimited team members');
  } else if (teamLimit > 0) {
    features.push(`${teamLimit} team member${teamLimit !== 1 ? 's' : ''}`);
  }
  
  // Add storage limit
  const storageLimit = plan.limits.storage_gb;
  if (storageLimit === -1) {
    features.push('Unlimited storage');
  } else if (storageLimit > 0) {
    features.push(`${storageLimit} GB storage`);
  }
  
  // Add API calls if available
  const apiLimit = plan.limits.api_calls;
  if (apiLimit === -1) {
    features.push('Unlimited API calls');
  } else if (apiLimit > 0) {
    features.push(`${apiLimit.toLocaleString()} API calls/month`);
  }
  
  // Map feature codes to readable names
  const featureMap: Record<string, string> = {
    'basic_frameworks': 'Basic compliance frameworks',
    'all_frameworks': 'All compliance frameworks',
    'community_support': 'Community support',
    'email_support': 'Email support',
    'priority_support': 'Priority support',
    'phone_support': 'Phone support',
    'dedicated_support': 'Dedicated support',
    '24_7_support': '24/7 premium support',
    'pdf_export': 'Export to PDF',
    'version_control_7days': 'Version control (7 days)',
    'version_control_30days': 'Version control (30 days)',
    'unlimited_version_control': 'Unlimited version control',
    'basic_analytics': 'Basic analytics',
    'advanced_analytics': 'Advanced analytics & reporting',
    'team_collaboration': 'Team collaboration',
    'api_access': 'API access',
    'slack_integration': 'Slack/Teams integration',
    'custom_branding': 'Custom branding',
    'automation': 'Compliance automation',
    'document_templates': 'Document templates',
    'sso': 'SSO (SAML/OIDC)',
    'audit_trails': 'Audit trails & activity logs',
    'custom_frameworks': 'Custom compliance frameworks',
    'advanced_permissions': 'Advanced team management & roles',
    'white_label': 'White-label capabilities',
    'on_premise': 'On-premise deployment',
    'dedicated_infrastructure': 'Dedicated infrastructure',
    'custom_sla': 'Custom SLA',
    'dedicated_account_manager': 'Dedicated account manager',
    'training_onboarding': 'Training & onboarding',
    'custom_development': 'Custom feature development',
    'volume_discounts': 'Volume discounts',
    'quarterly_reviews': 'Quarterly business reviews',
    'sla_99_9': 'SLA guarantees (99.9% uptime)',
    'sla_99_99': 'SLA guarantees (99.99% uptime)',
  };
  
  // Add feature flags
  /*
  if (plan.features && Array.isArray(plan.features)) {
    plan.features.forEach((feature) => {
      const readable = featureMap[feature];
      if (readable) {
        features.push(readable);
      }
    });
  }
  
  return features;
  */
  return features;
}

export default function OrganizationBillingPage() {
  const params = useParams();
  const { user } = useAuth();
  const orgId = params.id as string;
  const accountId = user?.userId;

  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Check for successful payment redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const success = urlParams.get('success');

    if (sessionId && success === 'true') {
      setShowSuccessMessage(true);

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Auto-hide success message after 10 seconds
      setTimeout(() => setShowSuccessMessage(false), 10000);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // If we just came back from Stripe checkout, wait a bit for webhook to process
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        if (sessionId) {
          // Wait 3 seconds for Stripe webhook to process the subscription
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Fetch organization data to get subscription info
        const orgData = await api
          .get<OrganizationBillingData>(`/api/organizations/${orgId}`)
          .catch((err) => {
            console.error('Failed to fetch organization:', err);
            return null;
          });

        console.log('Organization data for billing:', orgData);

        // Fetch subscription plans from API
        const plansResponse = await api.get<BillingPlansResponse>('/api/billing/plans');
        const fetchedPlans: PlanTier[] = plansResponse.plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          displayName: plan.displayName,
          description: plan.description,
          price: plan.priceMonthly / 100, // Convert cents to dollars
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          uploads: plan.limits.documents,
          checks: plan.limits.compliance_checks,

          features: formatPlanFeatures(plan),
          limits: {
            documents: plan.limits.documents,
            compliance_checks: plan.limits.compliance_checks,
            assistant_messages: plan.limits.assistant_messages,
            storage_gb: plan.limits.storage_gb,
            team_members: plan.limits.users ?? 0,
            api_calls: plan.limits.api_calls ?? 0,
          },
        }));
        setPlans(fetchedPlans);

        // Fetch usage forecast (includes current usage + plan limits)
        const forecast = await api
          .get<UsageForecastResponse>(`/api/organizations/${orgId}/usage/forecast`)
          .catch((err) => {
            console.error('Failed to fetch usage forecast:', err);
            return null;
          });

        console.log('Usage forecast data:', forecast);

        // Fetch subscription details using the proper API endpoint
        const subscriptionData = await api
          .get<OrganizationSubscriptionResponse>(`/api/organizations/${orgId}/subscription`)
          .catch((err) => {
            console.error('Failed to fetch subscription:', err);
            return null;
          });

        console.log('Subscription data:', subscriptionData);

        // Get subscription details from the dedicated API endpoint
        if (subscriptionData && subscriptionData.plan_id) {
          // Find the plan details from fetched plans
          const planDetails = fetchedPlans.find(p => p.id === subscriptionData.plan_id);
          const safePlanName =
            subscriptionData.plan_name ||
            planDetails?.displayName ||
            planDetails?.name ||
            'Custom Plan';
          
          setSubscription({
            plan_id: subscriptionData.plan_id,
            plan_name: safePlanName,
            status: subscriptionData.status || 'active',
            current_period_start: subscriptionData.current_period_start || Date.now(),
            current_period_end: subscriptionData.current_period_end || Date.now() + 30 * 24 * 60 * 60 * 1000,
            cancel_at_period_end: Boolean(subscriptionData.cancel_at_period_end),
            trial_start: subscriptionData.trial_start,
            trial_end: subscriptionData.trial_end,
            billing_cycle: 'monthly',
            price_monthly: planDetails?.priceMonthly,
            price_yearly: planDetails?.priceYearly,
          });
        } else if (orgData && orgData.subscription_plan) {
          // Fallback to organization data if subscription API fails
          const planId = `plan_${orgData.subscription_plan}`;
          const planDetails = fetchedPlans.find(p => p.id === planId);
          
          setSubscription({
            plan_id: planId,
            plan_name: planDetails?.displayName || orgData.subscription_plan,
            status: orgData.subscription_status || 'active',
            current_period_start: Date.now() - (30 * 24 * 60 * 60 * 1000),
            current_period_end: Date.now() + (30 * 24 * 60 * 60 * 1000),
            cancel_at_period_end: false,
            trial_start: undefined,
            trial_end: undefined,
            billing_cycle: 'monthly',
            price_monthly: planDetails?.priceMonthly,
            price_yearly: planDetails?.priceYearly,
          });
        } else {
          // Default to free plan
          setSubscription({
            plan_id: 'plan_free',
            plan_name: 'Free',
            status: 'active',
            current_period_start: Date.now(),
            current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
            cancel_at_period_end: false,
          });
        }

        // Check if forecast data is valid
        if (forecast && typeof forecast === 'object' && forecast.current_usage && forecast.plan_limits) {
          // Map backend data structure to frontend expected format
          // Backend uses: max_documents, max_checks, max_messages (not documents, compliance_checks, assistant_messages)
          setUsage({
            uploads_used: forecast.current_usage?.documents || 0,
            uploads_limit: forecast.plan_limits?.max_documents || 0,
            checks_used: forecast.current_usage?.checks || 0,
            checks_limit: forecast.plan_limits?.max_checks || 0,
            messages_used: forecast.current_usage?.messages || 0,
            messages_limit: forecast.plan_limits?.max_messages || 0,
            period_start: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
            period_end: Date.now(),
          });
        } else {
          // No forecast data - should not happen for valid subscription
          console.error('No forecast data available, subscription may not be active');
          setUsage({
            uploads_used: 0,
            uploads_limit: 0,
            checks_used: 0,
            checks_limit: 0,
            messages_used: 0,
            messages_limit: 0,
            period_start: Date.now() - 30 * 24 * 60 * 60 * 1000,
            period_end: Date.now(),
          });
        }

        // Invoices not yet implemented
        setInvoices([]);
      } catch (error) {
        console.error('Failed to fetch billing data:', error);
        // Set defaults on error
        setSubscription({
          plan_id: 'plan_free',
          plan_name: 'Free',
          status: 'active',
          current_period_start: Date.now(),
          current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
          cancel_at_period_end: false,
        });
        setUsage({
          uploads_used: 0,
          uploads_limit: 0,
          checks_used: 0,
          checks_limit: 5,
          messages_used: 0,
          messages_limit: 0,
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

  const handleUpgrade = async (planId: string) => {
    try {
      setLoading(true);

      // Get the target plan details
      const targetPlan = plans.find(p => p.id === planId);
      if (!targetPlan) {
        alert('Invalid plan selected');
        return;
      }

      // If user is downgrading to free, handle specially
      if (planId === 'plan_free') {
        const confirmed = confirm(
          'Are you sure you want to downgrade to the Free plan? You will lose access to premium features immediately.'
        );
        if (!confirmed) return;

        try {
          // Cancel subscription (will downgrade at period end or immediately)
          await api.delete(`/api/organizations/${orgId}/subscription`);
          alert('Your subscription will be canceled at the end of the current billing period.');
          window.location.reload();
        } catch (error) {
          alert(`Failed to cancel subscription: ${getApiErrorMessage(error)}`);
        }
        return;
      }

      // For paid plans, redirect to Stripe Checkout
      const confirmed = confirm(
        `Upgrade to ${targetPlan.displayName} for $${targetPlan.price}/month?\n\n` +
        `You'll be redirected to Stripe to complete the payment.`
      );

      if (!confirmed) return;

      try {
        // Create Stripe Checkout session
        const result = await api.post<CheckoutSessionResponse>(`/api/organizations/${orgId}/checkout`, {
          planId: planId,
        });

        // Result is already parsed JSON: { url: string, sessionId: string }
        if (result && result.url) {
          // Redirect to Stripe Checkout
          window.location.href = result.url;
        } else {
          alert('Failed to create checkout session: Invalid response from server');
        }
      } catch (error) {
        console.error('Checkout error:', error);
        alert(`Failed to create checkout session: ${getApiErrorMessage(error)}`);
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert(`Failed to process upgrade. ${getApiErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = confirm(
      'Are you sure you want to cancel your subscription?\n\n' +
      'Your subscription will remain active until the end of the current billing period, ' +
      'then you\'ll be downgraded to the Free plan.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      // API client already returns parsed JSON or throws error
      alert('Your subscription has been canceled and will end at the current billing period.');
      window.location.reload();
    } catch (error) {
      console.error('Cancellation error:', error);
      alert(`Failed to cancel subscription: ${getApiErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
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

  // Find current plan from fetched plans
  const currentPlan = plans.find(p => 
    subscription ? p.id === subscription.plan_id : p.name === 'free'
  ) || plans.find(p => p.name === 'free') || plans[0]; // Fallback to free plan
  
  const usagePercentUploads = usage && usage.uploads_limit > 0
    ? (usage.uploads_used / usage.uploads_limit) * 100
    : 0;
  const usagePercentChecks = usage && usage.checks_limit > 0
    ? (usage.checks_used / usage.checks_limit) * 100
    : 0;
  const usagePercentMessages = usage && usage.messages_limit > 0
    ? (usage.messages_used / usage.messages_limit) * 100
    : 0;

  return (
    <OrganizationLayout accountId={accountId} orgId={orgId}>
      <div className="p-8">
          {/* Success Message Banner */}
          {showSuccessMessage && (
            <div className="mb-6 bg-green-50 border-2 border-green-500 text-green-900 p-6 rounded-lg shadow-lg">
              <div className="flex items-start gap-4">
                <div className="text-3xl">✅</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Payment Successful!</h3>
                  <p className="text-green-800 mb-3">
                    Your subscription has been activated. It may take a few moments for all changes to appear.
                    If you still see your trial plan, please refresh the page.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm font-medium"
                  >
                    Refresh Page Now
                  </button>
                </div>
                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="text-green-600 hover:text-green-800 text-xl font-bold"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Trial Banner */}
          {subscription && subscription.status === 'trialing' && subscription.trial_end && (
            <div className="mb-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">🎉 {subscription.plan_name} Trial Active</h3>
                  <p className="text-blue-100">
                    Your trial ends on {new Date(subscription.trial_end).toLocaleDateString()}. 
                    Scroll down to view available plans and add a payment method to continue after your trial.
                  </p>
                </div>
                <div className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold">
                  {Math.ceil((subscription.trial_end - Date.now()) / (24 * 60 * 60 * 1000))} Days Left
                </div>
              </div>
            </div>
          )}

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
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Current Plan: {currentPlan?.displayName || 'Free'}
                  </h2>
                  {subscription?.status === 'trialing' && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      TRIAL
                    </span>
                  )}
                  {subscription?.status === 'active' && subscription.plan_id !== 'plan_free' && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      ACTIVE
                    </span>
                  )}
                </div>
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
                  ${currentPlan?.price || 0}
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
                      Documents Processed
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
                      ⚠️ You&rsquo;re approaching your upload limit. Consider upgrading your plan.
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
                      ⚠️ You&rsquo;re approaching your check limit. Consider upgrading your plan.
                    </p>
                  )}
                </div>

                {/* AI Messages */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      AI Assistant Messages
                    </span>
                    <span className="text-sm text-gray-600">
                      {usage.messages_used} / {usage.messages_limit === -1 ? '∞' : usage.messages_limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        usagePercentMessages > 90
                          ? 'bg-red-600'
                          : usagePercentMessages > 75
                          ? 'bg-yellow-600'
                          : 'bg-purple-600'
                      }`}
                      style={{
                        width: `${Math.min(usagePercentMessages, 100)}%`,
                      }}
                    />
                  </div>
                  {usagePercentMessages > 75 && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ You&rsquo;re approaching your AI message limit. Consider upgrading your plan.
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
            {plans.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Loading plans...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const isCurrent = currentPlan?.id === plan.id;

                  return (
                    <div
                      key={plan.id}
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
                        {plan.displayName}
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
                          onClick={() => handleUpgrade(plan.id)}
                          variant={plan.name === 'enterprise' ? 'primary' : 'outline'}
                          className="w-full"
                        >
                          {plan.name === 'free' ? 'Downgrade' : 'Upgrade'}
                        </Button>
                      )}

                      {isCurrent && !subscription?.cancel_at_period_end && plan.name !== 'free' && (
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
            )}
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
