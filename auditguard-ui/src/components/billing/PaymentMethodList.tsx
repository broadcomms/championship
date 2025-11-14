'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface PaymentMethodListProps {
  workspaceId: string;
}

export function PaymentMethodList({ workspaceId }: PaymentMethodListProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentMethods();
  }, [workspaceId]);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/api/workspaces/${workspaceId}/payment-methods`);
      setPaymentMethods(data.paymentMethods || []);
      setError(null);
    } catch (err) {
      setError('Failed to load payment methods');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      setActionLoading(paymentMethodId);
      await api.post(
        `/api/workspaces/${workspaceId}/payment-methods/${paymentMethodId}/set-default`
      );
      await loadPaymentMethods();
    } catch (err) {
      alert('Failed to set default payment method');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      setActionLoading(paymentMethodId);
      await api.delete(`/api/workspaces/${workspaceId}/payment-methods/${paymentMethodId}`);
      await loadPaymentMethods();
    } catch (err) {
      alert('Failed to remove payment method');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const getCardBrandIcon = (brand: string) => {
    const brandLower = brand.toLowerCase();

    if (brandLower === 'visa') {
      return (
        <svg className="h-8 w-12" viewBox="0 0 48 32" fill="none">
          <rect width="48" height="32" rx="4" fill="#1434CB" />
          <text x="24" y="20" fontSize="14" fill="white" fontWeight="bold" textAnchor="middle">
            VISA
          </text>
        </svg>
      );
    } else if (brandLower === 'mastercard') {
      return (
        <svg className="h-8 w-12" viewBox="0 0 48 32">
          <rect width="48" height="32" rx="4" fill="#EB001B" />
          <circle cx="20" cy="16" r="8" fill="#FF5F00" />
          <circle cx="28" cy="16" r="8" fill="#F79E1B" />
        </svg>
      );
    } else if (brandLower === 'amex') {
      return (
        <svg className="h-8 w-12" viewBox="0 0 48 32">
          <rect width="48" height="32" rx="4" fill="#006FCF" />
          <text x="24" y="20" fontSize="12" fill="white" fontWeight="bold" textAnchor="middle">
            AMEX
          </text>
        </svg>
      );
    }

    // Default card icon
    return (
      <svg className="h-8 w-12 text-gray-400" fill="none" viewBox="0 0 48 32" stroke="currentColor">
        <rect width="48" height="32" rx="4" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h40M12 20h8" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

  if (paymentMethods.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No payment methods</h3>
        <p className="mt-1 text-sm text-gray-500">
          Add a payment method to subscribe to a paid plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {paymentMethods.map((method) => (
        <div
          key={method.id}
          className={`relative rounded-lg border ${
            method.isDefault ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
          } p-4`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Card Icon */}
              <div className="flex-shrink-0">{getCardBrandIcon(method.brand)}</div>

              {/* Card Details */}
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                </p>
                <p className="text-sm text-gray-500">
                  Expires {String(method.expMonth).padStart(2, '0')}/{method.expYear}
                </p>
              </div>

              {/* Default Badge */}
              {method.isDefault && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Default
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {!method.isDefault && (
                <button
                  onClick={() => handleSetDefault(method.id)}
                  disabled={actionLoading === method.id}
                  className="text-sm text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50"
                >
                  {actionLoading === method.id ? 'Setting...' : 'Set as default'}
                </button>
              )}
              <button
                onClick={() => handleRemove(method.id)}
                disabled={actionLoading === method.id}
                className="text-sm text-red-600 hover:text-red-500 font-medium disabled:opacity-50"
              >
                {actionLoading === method.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Add New Card Button */}
      <button
        onClick={() => {
          // This would typically open a modal with Stripe Elements
          alert('Add new payment method - implement modal with Stripe Elements');
        }}
        className="w-full rounded-lg border-2 border-dashed border-gray-300 p-4 text-center hover:border-gray-400 transition-colors"
      >
        <svg
          className="mx-auto h-8 w-8 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span className="mt-2 block text-sm font-medium text-gray-600">
          Add new payment method
        </span>
      </button>
    </div>
  );
}
