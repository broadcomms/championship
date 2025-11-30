'use client';

import { useState, useEffect } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { api } from '@/lib/api';

interface CheckoutFormProps {
  workspaceId: string;
  planId: string;
  planName: string;
  price: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface WorkspaceSubscriptionResponse {
  subscription: {
    id?: string;
    status?: string;
  } | null;
}

interface SubscriptionMutationResponse {
  status: string;
  clientSecret?: string;
  subscriptionId: string;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: 'system-ui, sans-serif',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

export function CheckoutForm({
  workspaceId,
  planId,
  planName,
  price,
  onSuccess,
  onCancel,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [hasExistingSubscription, setHasExistingSubscription] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const result = await api.get<WorkspaceSubscriptionResponse>(`/api/workspaces/${workspaceId}/subscription`);
        setHasExistingSubscription(result.subscription !== null);
      } catch (err) {
        console.error('Failed to check subscription:', err);
      } finally {
        setCheckingSubscription(false);
      }
    };
    checkSubscription();
  }, [workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Check if subscription already exists
      const existingSubscription = await api.get<WorkspaceSubscriptionResponse>(`/api/workspaces/${workspaceId}/subscription`);
      const hasSubscription = existingSubscription.subscription !== null;

      let response: SubscriptionMutationResponse;

      if (hasSubscription) {
        // Update existing subscription (upgrade/downgrade)
        response = await api.put<SubscriptionMutationResponse>(`/api/workspaces/${workspaceId}/subscription`, {
          planId,
        });

        // Check if payment confirmation is needed for upgrade
        if (response.status === 'incomplete' && response.clientSecret && stripe) {
          const { error: confirmError } = await stripe.confirmCardPayment(
            response.clientSecret
          );

          if (confirmError) {
            throw new Error(confirmError.message);
          }

          // After payment confirmation, poll for subscription status update
          await pollSubscriptionStatus(response.subscriptionId, 10, 1000);
        }

        // Success - upgrade completed
        if (onSuccess) {
          onSuccess();
        }
        return;
      }

      // New subscription - need to collect payment method
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment method
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (pmError) {
        throw new Error(pmError.message);
      }

      // Create subscription with payment method
      response = await api.post<SubscriptionMutationResponse>(`/api/workspaces/${workspaceId}/subscription`, {
        planId,
        paymentMethodId: paymentMethod!.id,
      });

      // Handle payment confirmation if subscription requires it
      if (response.status === 'incomplete' && response.clientSecret) {
        const { error: confirmError } = await stripe.confirmCardPayment(
          response.clientSecret
        );

        if (confirmError) {
          throw new Error(confirmError.message);
        }

        // After payment confirmation, poll for subscription status update
        // This ensures the webhook has processed and status is 'active'
        await pollSubscriptionStatus(response.subscriptionId, 10, 1000);
      }

      // Success!
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  // Poll subscription status until it becomes 'active' or max attempts reached
  const pollSubscriptionStatus = async (
    subscriptionId: string,
    maxAttempts: number,
    delayMs: number
  ): Promise<void> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Sync subscription status from Stripe
        await api.post(`/api/workspaces/${workspaceId}/subscription/sync`, {});

        // Fetch the updated subscription
        const result = await api.get<WorkspaceSubscriptionResponse>(`/api/workspaces/${workspaceId}/subscription`);

        if (result.subscription?.status === 'active') {
          // Subscription is now active!
          return;
        }

        if (result.subscription?.status === 'incomplete' || result.subscription?.status === 'trialing') {
          // Still processing, wait and try again
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        // Unexpected status or no subscription
        if (!result.subscription) {
          throw new Error('Subscription not found');
        }
        throw new Error(`Subscription status is ${result.subscription.status}`);
      } catch (err) {
        // On last attempt, throw the error
        if (attempt === maxAttempts - 1) {
          throw err;
        }
        // Otherwise wait and retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // If we get here, polling timed out but payment was successful
    // The webhook will eventually update the status, so we can proceed
    console.warn('Subscription status polling timed out, but payment was confirmed');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Order Summary</h3>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{planName} Plan</span>
          <span className="text-lg font-bold text-gray-900">
            ${(price / 100).toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Billed monthly. Cancel anytime.
        </p>
      </div>

      {/* Card Input - Only show for new subscriptions */}
      {!hasExistingSubscription && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Information
          </label>
          <div className="border border-gray-300 rounded-md p-3 bg-white">
            <CardElement
              options={CARD_ELEMENT_OPTIONS}
              onChange={(e) => setCardComplete(e.complete)}
            />
          </div>
        </div>
      )}

      {/* Upgrade Notice */}
      {hasExistingSubscription && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-800">
            You will be upgraded to the {planName} plan. Your existing payment method will be used, and you&rsquo;ll be charged the prorated amount immediately.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
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
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Security Notice - Only show for new subscriptions */}
      {!hasExistingSubscription && (
        <div className="flex items-start space-x-2 text-xs text-gray-600">
          <svg
            className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p>
            Your payment information is encrypted and secure. We use Stripe for
            payment processing and never store your card details.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || processing || (!hasExistingSubscription && !cardComplete) || checkingSubscription}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {processing ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </span>
          ) : checkingSubscription ? (
            'Loading...'
          ) : hasExistingSubscription ? (
            `Upgrade to ${planName}`
          ) : (
            `Subscribe for $${(price / 100).toFixed(2)}/mo`
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Terms */}
      <p className="text-xs text-gray-500 text-center">
        By subscribing, you agree to our{' '}
        <a href="/terms" className="text-blue-600 hover:text-blue-500">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="/privacy" className="text-blue-600 hover:text-blue-500">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
