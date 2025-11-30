"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const contactSchema = z.object({
  name: z.string().min(2, 'Please provide your full name'),
  email: z.string().email('Enter a valid work email'),
  company: z.string().min(2, 'Company name required'),
  plan: z.string().optional(),
  message: z.string().min(10, 'Tell us more about your compliance goals'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      plan: 'professional',
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
    setStatus('loading');
    try {
      const response = await fetch('/api/marketing/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Unable to submit.');
      }

      setStatus('success');
      reset();
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-900">Full name</label>
        <input
          type="text"
          {...register('name')}
          className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          placeholder="Sarah Chen"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900">Work email</label>
        <input
          type="email"
          {...register('email')}
          className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          placeholder="you@company.com"
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900">Company</label>
        <input
          type="text"
          {...register('company')}
          className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          placeholder="CloudBridge Software"
        />
        {errors.company && <p className="mt-1 text-xs text-red-600">{errors.company.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900">Plan of interest</label>
        <select
          {...register('plan')}
          className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900">How can we help?</label>
        <textarea
          rows={4}
          {...register('message')}
          className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          placeholder="Tell us about your frameworks, audit timeline, and stakeholders."
        />
        {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>}
      </div>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-70"
      >
        {status === 'loading' ? 'Sending...' : 'Schedule a demo'}
      </button>
      {status === 'success' && (
        <p className="text-sm text-green-600">
          Thanks for reaching out! Our team will respond within one business day.
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
