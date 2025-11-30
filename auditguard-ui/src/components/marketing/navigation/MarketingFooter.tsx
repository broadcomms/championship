"use client";

import Link from 'next/link';
import { NewsletterSignup } from '@/components/marketing/forms/NewsletterSignup';
import { contactChannels } from '@/config/marketing';
import { BrandLogo } from './BrandLogo';

const footerColumns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/company/about' },
      { label: 'Contact', href: '/company/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/security/terms' },
      { label: 'Privacy', href: '/security/privacy' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mt-24 bg-gray-900 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="space-y-4">
          <BrandLogo variant="light" className="text-white" />
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">Newsletter</p>
            <p className="mt-2 text-sm text-white">
              Weekly compliance playbooks, product launches, and CRO experiments.
            </p>
            <div className="mt-4">
              <NewsletterSignup />
            </div>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-semibold tracking-wide text-white/80">{column.title}</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-400">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link className="transition hover:text-white" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} AuditGuardX. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            {contactChannels.map((channel) => (
              <div key={channel.label}>
                <p className="font-semibold text-white">{channel.label}</p>
                <p>{channel.value}</p>
                <p className="text-xs text-gray-500">{channel.subtext}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
