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
  email: z.string().email('Please enter a valid email address'),
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
      const error = err as ErrorResponse & {
        code?: string;
        ssoRequired?: boolean;
        organizationId?: string;
        organizationName?: string;
        provider?: string;
      };

      // SSO ENFORCEMENT: If SSO is required, automatically redirect to SSO login
      if (error.code === 'SSO_REQUIRED' && error.ssoRequired && error.organizationId) {
        setError(
          `SSO authentication required for ${error.organizationName || 'your organization'}. Redirecting to SSO login...`
        );

        // Wait 2 seconds to show the message, then redirect to SSO
        setTimeout(async () => {
          try {
            const response = await api.get<{ authorizationUrl: string; state: string }>(
              `/api/auth/sso/authorize?organizationId=${error.organizationId}`
            );
            window.location.href = response.authorizationUrl;
          } catch (ssoErr) {
            const ssoError = ssoErr as ErrorResponse;
            setError(ssoError.error || 'Failed to initiate SSO login.');
            setLoading(false);
          }
        }, 2000);
        return;
      }

      setError(error.error || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  const onSsoSubmit = async (data: SSOFormData) => {
    setError(null);
    setSsoLoading(true);

    try {
      // First, detect SSO from email domain
      const detection = await api.post<{
        hasSso: boolean;
        organizationId?: string;
        organizationName?: string;
        provider?: string;
      }>('/api/auth/sso/detect', { email: data.email });

      if (!detection.hasSso || !detection.organizationId) {
        setError(
          'No SSO configuration found for your email domain. Please use email/password login or contact your administrator.'
        );
        setSsoLoading(false);
        return;
      }

      // Get authorization URL from backend
      const response = await api.get<{ authorizationUrl: string; state: string }>(
        `/api/auth/sso/authorize?organizationId=${detection.organizationId}`
      );

      // Redirect to WorkOS authorization URL
      window.location.href = response.authorizationUrl;
    } catch (err) {
      const error = err as ErrorResponse;
      setError(error.error || 'Failed to initiate SSO login. Please try again.');
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

                <div>
                  <Input
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    error={errors.password?.message}
                    {...register('password')}
                  />
                  <div className="mt-2 text-right">
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>
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
                <span className="bg-gray-50 px-2 text-gray-500">Or continue with</span>
              </div>
            </div>

            {/* OAuth Social Login Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/oauth/google`;
                }}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/oauth/microsoft`;
                }}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#f25022" d="M1 1h10v10H1z" />
                  <path fill="#00a4ef" d="M13 1h10v10H13z" />
                  <path fill="#7fba00" d="M1 13h10v10H1z" />
                  <path fill="#ffb900" d="M13 13h10v10H13z" />
                </svg>
                Microsoft
              </Button>
            </div>

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
                    Enter your work email address. We&rsquo;ll automatically detect your organization&rsquo;s SSO configuration.
                  </p>
                </div>

                <Input
                  label="Work Email Address"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  error={ssoErrors.email?.message}
                  {...registerSso('email')}
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
