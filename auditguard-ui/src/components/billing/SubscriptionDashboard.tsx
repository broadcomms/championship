'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Subscription, WorkspaceLimits } from '@/types';
import { UsageMetrics } from './UsageMetrics';
import Link from 'next/link';

interface SubscriptionDashboardProps {
  workspaceId: string;
}

export function SubscriptionDashboard({ workspaceId }: SubscriptionDashboardProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [limits, setLimits] = useState<WorkspaceLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subData, limitsData] = await Promise.all([
        api.get(`/api/workspaces/${workspaceId}/subscription`),
        api.get(`/api/workspaces/${workspaceId}/limits`),
      ]);
      setSubscription(subData.subscription);
      setLimits(limitsData);
      setError(null);
    } catch (err) {
      setError('Failed to load subscription data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncStatus = async () => {
    try {
      setSyncing(true);
      setError(null);

      // Sync subscription status from Stripe
      await api.post(`/api/workspaces/${workspaceId}/subscription/sync`, {});

      // Reload subscription data
      await loadData();
    } catch (err: any) {
      const errorMessage = err?.error || err?.message || 'Failed to sync subscription status';
      
      // Check if it's a database constraint error (migration not applied yet)
      if (errorMessage.includes('NOT NULL constraint') || errorMessage.includes('current_period')) {
        setError('Subscription sync temporarily unavailable. Please contact support or try again later.');
      } else {
        setError(errorMessage);
      }
      console.error('Subscription sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      active: { color: 'bg-green-100 text-green-800', text: 'Active' },
      trialing: { color: 'bg-blue-100 text-blue-800', text: 'Trial' },
      incomplete: { color: 'bg-yellow-100 text-yellow-800', text: 'Payment Pending' },
      incomplete_expired: { color: 'bg-red-100 text-red-800', text: 'Payment Expired' },
      past_due: { color: 'bg-yellow-100 text-yellow-800', text: 'Past Due' },
      canceled: { color: 'bg-red-100 text-red-800', text: 'Canceled' },
      paused: { color: 'bg-gray-100 text-gray-800', text: 'Paused' },
    };

    const badge = badges[status] || { color: 'bg-gray-100 text-gray-800', text: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Current Subscription
            </h3>
            <div className="flex items-center gap-2">
              {subscription && getStatusBadge(subscription.status)}
              {subscription && (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') && (
                <button
                  onClick={handleSyncStatus}
                  disabled={syncing}
                  className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh subscription status from Stripe"
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg className="-ml-0.5 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Status
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {subscription ? (
            <div className="space-y-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">{subscription.planName}</p>
                {subscription.status === 'active' && subscription.currentPeriodEnd && (
                  <p className="mt-1 text-sm text-gray-600">
                    Renews on {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
                {subscription.cancel_at_period_end && (
                  <p className="mt-2 text-sm text-yellow-600 font-medium">
                    ⚠️ Scheduled to cancel on {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/workspaces/${workspaceId}/billing/upgrade`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Change Plan
                </Link>
                <Link
                  href={`/workspaces/${workspaceId}/billing/payment-methods`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Payment Methods
                </Link>
                <Link
                  href={`/workspaces/${workspaceId}/billing/invoices`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Billing History
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">You're currently on the Free plan.</p>
              <Link
                href={`/workspaces/${workspaceId}/billing/upgrade`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Upgrade to Pro
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Usage Statistics */}
      {limits && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <UsageMetrics limits={limits} />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href={`/workspaces/${workspaceId}/billing/upgrade`}
              className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
            >
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">Upgrade Plan</p>
                <p className="text-sm text-gray-500 truncate">Get more features and higher limits</p>
              </div>
            </Link>

            <Link
              href={`/workspaces/${workspaceId}/billing/invoices`}
              className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
            >
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">View Invoices</p>
                <p className="text-sm text-gray-500 truncate">Download past invoices and receipts</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
