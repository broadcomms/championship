'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { ErrorResponse } from '@/types';
import { api } from '@/lib/api';
import { AuthLayout } from '@/components/auth/AuthLayout';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const ssoSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SSOFormData = z.infer<typeof ssoSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [showSsoForm, setShowSsoForm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerSso,
    handleSubmit: handleSsoSubmit,
    formState: { errors: ssoErrors },
  } = useForm<SSOFormData>({
    resolver: zodResolver(ssoSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setLoading(true);

    try {
      const userData = await login(data.email, data.password);
      // Redirect to account dashboard as per blueprint
      const accountId = userData?.userId;
      if (accountId) {
        router.push(`/account/${accountId}`);
      } else {
        // Fallback to organizations if account ID not available
        router.push('/organizations');
      }
    } catch (err) {
      const error = err as ErrorResponse;
      setError(error.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const onSsoSubmit = async (data: SSOFormData) => {
    setError(null);
    setSsoLoading(true);

    try {
      // Get authorization URL from backend
      const response = await api.get<{ authorizationUrl: string; state: string }>(
        `/api/auth/sso/authorize?organizationId=${data.organizationId}`
      );

      // Redirect to WorkOS authorization URL
      window.location.href = response.authorizationUrl;
    } catch (err) {
      const error = err as ErrorResponse;
      setError(error.error || 'Failed to initiate SSO login. Please check your organization ID.');
      setSsoLoading(false);
    }
  };

  return (
    <AuthLayout
      hero={{
        eyebrow: 'Audit-ready access',
        heading: 'Secure workspace login with AI copilots on standby',
        description:
          'SSO via WorkOS plus passwordless-ready email keeps every workspace aligned with SOC 2 and HIPAA controls.',
        bullets: [
          '24/7 monitoring on Raindrop Smart Components',
          'Hands-free assistant available after sign-in',
          'Audit trails, MFA, and device trust baked in',
        ],
      }}
    >
      <div className="space-y-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Welcome back</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">Sign in to your account</h2>
          <p className="mt-2 text-sm text-slate-500">Access your compliance workspace or rejoin an in-progress audit.</p>
        </div>

        {!showSsoForm ? (
          <>
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  loading={loading}
                  disabled={loading}
                >
                  Sign in
                </Button>
              </div>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-gray-50 px-2 text-gray-500">Or</span>
              </div>
            </div>

            {/* SSO Login Button */}
            <div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowSsoForm(true)}
              >
                Sign in with SSO
              </Button>
            </div>

            <div className="text-center text-sm">
              <span className="text-gray-600">Don&rsquo;t have an account? </span>
              <Link
                href="/register"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign up
              </Link>
            </div>
          </>
        ) : (
          <>
            <form className="space-y-6" onSubmit={handleSsoSubmit(onSsoSubmit)}>
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="rounded-md bg-blue-50 p-4">
                  <p className="text-sm text-blue-800">
                    Enter your organization ID to sign in with SSO
                  </p>
                </div>

                <Input
                  label="Organization ID"
                  type="text"
                  placeholder="org_XXXXXXXXXXXXXXXXXXXXXXXX"
                  error={ssoErrors.organizationId?.message}
                  {...registerSso('organizationId')}
                />
              </div>

              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  loading={ssoLoading}
                  disabled={ssoLoading}
                >
                  Continue with SSO
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowSsoForm(false);
                    setError(null);
                  }}
                  disabled={ssoLoading}
                >
                  Back to email login
                </Button>
              </div>
            </form>

            <div className="text-center text-sm">
              <span className="text-gray-600">Don&rsquo;t have an account? </span>
              <Link
                href="/register"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign up
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
