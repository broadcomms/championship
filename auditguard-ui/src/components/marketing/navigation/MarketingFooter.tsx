"use client";

import Link from 'next/link';
import { NewsletterSignup } from '@/components/marketing/forms/NewsletterSignup';
import { contactChannels } from '@/config/marketing';
import { BrandLogo } from './BrandLogo';

const footerLinks = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About Us', href: '/company/about' },
  { label: 'Contact', href: '/company/contact' },
  { label: 'Terms', href: '/security/terms' },
  { label: 'Privacy', href: '/security/privacy' },
];

const complianceBadges = ['SOC 2', 'HIPAA', 'ISO 27001', 'GDPR', 'PCI-DSS', '+17 More'];

export function MarketingFooter() {
  return (
    <footer className="relative mt-0 bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <BrandLogo variant="light" className="text-white" />
            <p className="text-sm text-slate-300">
              Launch an audit-ready compliance program across your organization with AI copilots, automated evidence tracking, and instant workspace setup with team collaboration across multiple International standards.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              {complianceBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_10px_60px_rgba(15,23,42,0.45)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Newsletter</p>
            <p className="mt-3 text-lg font-semibold">Stay ahead of audit season</p>
            <p className="mt-2 text-sm text-white/80">Weekly dispatch with playbooks, community invites, and launch notes.</p>
            <div className="mt-5">
              <NewsletterSignup />
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {contactChannels.map((channel) => (
            <div key={channel.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">{channel.label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{channel.value}</p>
              <p className="text-sm text-white/70">{channel.subtext}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-8 text-sm text-slate-400">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-3">
              {footerLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="rounded-full border border-white/10 px-4 py-1.5 text-white transition hover:border-white/40 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <p className="text-xs text-slate-500 md:text-right">© {new Date().getFullYear()} AuditGuardX. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
