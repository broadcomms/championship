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
import { AuthLayout } from '@/components/auth/AuthLayout';

// Validation schema
const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    setLoading(true);

    try {
      const userData = await registerUser(data.email, data.password, data.name);
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
      setError(error.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      hero={{
        eyebrow: 'Launch-ready signup',
        heading: 'Spin up an AI-powered compliance workspace in minutes',
        description:
          'Unified onboarding guides you from workspace creation to first evidence upload, no consultants required.',
        bullets: [
          'WorkOS SSO + Stripe billing configured out of the box',
          'Smart bucket storage with Vultr speed',
          'Voice copilots assist during every onboarding step',
        ],
      }}
    >
      <div className="space-y-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Get started</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">Create your account</h2>
          <p className="mt-2 text-sm text-slate-500">Start the 14-day Professional trial with instant workspace provisioning.</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Full name"
              type="text"
              autoComplete="name"
              placeholder="John Doe"
              error={errors.name?.message}
              {...register('name')}
            />

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
              autoComplete="new-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={loading}
            >
              Create account
            </Button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
