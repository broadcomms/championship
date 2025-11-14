'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { ReactNode, useMemo } from 'react';

// Initialize Stripe with publishable key
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface StripeProviderProps {
  children: ReactNode;
  clientSecret?: string;
}

export function StripeProvider({ children, clientSecret }: StripeProviderProps) {
  const options: StripeElementsOptions | undefined = useMemo(() => {
    if (clientSecret) {
      return {
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#3b82f6',
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, sans-serif',
            borderRadius: '8px',
          },
        },
      };
    }
    return undefined;
  }, [clientSecret]);

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
