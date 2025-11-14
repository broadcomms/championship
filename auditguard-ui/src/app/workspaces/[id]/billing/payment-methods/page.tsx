'use client';

import { PaymentMethodList } from '@/components/billing/PaymentMethodList';
import { AppLayout } from '@/components/layout/AppLayout';
import Link from 'next/link';

interface PaymentMethodsPageProps {
  params: {
    id: string;
  };
}

export default function PaymentMethodsPage({ params }: PaymentMethodsPageProps) {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/workspaces/${params.id}/billing`}
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
          Back to Billing
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Payment Methods</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your saved payment methods and update billing information.
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm text-blue-700">
              Your payment information is securely stored by Stripe. We never see or store your
              full card details. Your default payment method will be used for subscription renewals.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Methods List */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <PaymentMethodList workspaceId={params.id} />
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Frequently Asked Questions
        </h3>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-900">
              How do I change my default payment method?
            </dt>
            <dd className="mt-1 text-sm text-gray-600">
              Click "Set as default" on any saved payment method to make it your primary card for
              future charges.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-900">
              Can I use multiple payment methods?
            </dt>
            <dd className="mt-1 text-sm text-gray-600">
              Yes, you can save multiple payment methods. However, only your default payment method
              will be charged for subscription renewals.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-900">
              What happens if my payment fails?
            </dt>
            <dd className="mt-1 text-sm text-gray-600">
              If a payment fails, we'll automatically retry with your default payment method. You'll
              receive email notifications and your account will remain active during the retry period.
            </dd>
          </div>
        </dl>
      </div>
    </div>
    </AppLayout>
  );
}
