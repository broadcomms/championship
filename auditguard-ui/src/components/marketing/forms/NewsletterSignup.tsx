"use client";

import { useState } from 'react';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) return;
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/marketing/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Unable to subscribe right now.');
      }

      setStatus('success');
      setMessage("You're on the list! Check your inbox for the latest playbooks.");
      setEmail('');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/70 focus:border-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-600 shadow-lg transition hover:bg-blue-50 disabled:opacity-70"
        >
          {status === 'loading' ? 'Joining...' : 'Subscribe'}
        </button>
      </div>
      {message && (
        <p className="text-xs text-white/80">{message}</p>
      )}
    </form>
  );
}
