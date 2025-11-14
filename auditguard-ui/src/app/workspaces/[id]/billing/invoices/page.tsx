'use client';

import { InvoiceList } from '@/components/billing/InvoiceList';
import { AppLayout } from '@/components/layout/AppLayout';
import Link from 'next/link';

interface InvoicesPageProps {
  params: {
    id: string;
  };
}

export default function InvoicesPage({ params }: InvoicesPageProps) {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        <h1 className="text-3xl font-bold text-gray-900">Billing History</h1>
        <p className="mt-2 text-sm text-gray-600">
          View and download past invoices and receipts.
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
              All invoices are available for download as PDF files. You can view detailed breakdowns
              or download receipts for accounting purposes.
            </p>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white">
        <InvoiceList workspaceId={params.id} />
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Need help with billing?
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          If you have questions about a specific invoice or need assistance with billing,
          our support team is here to help.
        </p>
        <div className="flex gap-3">
          <a
            href="/support"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Contact Support
          </a>
          <a
            href="/docs/billing"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            View Billing Documentation
          </a>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
