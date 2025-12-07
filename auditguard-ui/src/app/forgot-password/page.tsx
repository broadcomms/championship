'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/common/Button';
import { Mail, ArrowLeft, AlertCircle, Check } from 'lucide-react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    // Validate email
    if (!email) {
      setError('Email is required');
      setIsSubmitting(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setIsSubmitting(false);
      return;
    }

    try {
      await api.post('/api/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      const error = err as { error?: string };
      setError(error.error || 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-lg bg-white p-8 shadow-sm">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
              Check your email
            </h1>
            <p className="mb-6 text-center text-gray-600">
              If an account exists with <strong>{email}</strong>, you will receive a password reset
              link shortly.
            </p>

            <div className="space-y-4">
              <Link href="/login">
                <Button variant="secondary" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Button>
              </Link>

              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-700"
              >
                Try a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Mail className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Forgot your password?</h1>
            <p className="mt-2 text-gray-600">
              Enter your email address and we&rsquo;ll send you a link to reset your password.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                required
                disabled={isSubmitting}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
