"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from './BrandLogo';

type NavItem = {
  label: string;
  href: string;
  description?: string;
};

const navItems: NavItem[] = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Company', href: '/company/about' },
];

export function MarketingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 4);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed left-0 right-0 top-0 z-40 transition-all duration-300',
        isScrolled ? 'bg-white/95 shadow-lg backdrop-blur-md' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-sm font-medium text-gray-900 sm:px-6 lg:px-8">
        <BrandLogo hideSubtitle />

        <nav className="hidden gap-6 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group flex flex-col text-gray-600 transition hover:text-gray-900"
            >
              <span>{item.label}</span>
              {item.description && (
                <span className="text-xs text-gray-400 transition group-hover:text-gray-500">
                  {item.description}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
          >
            Start Free Trial
          </Link>
        </div>

        <button
          className="rounded-md p-2 text-gray-700 transition hover:bg-gray-100 lg:hidden"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 shadow-lg sm:px-6 lg:hidden">
          <div className="flex flex-col gap-4 text-gray-700">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="font-medium" onClick={() => setMobileOpen(false)}>
                {item.label}
                {item.description && (
                  <span className="block text-xs font-normal text-gray-400">{item.description}</span>
                )}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/login"
                className="rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-semibold"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white"
                onClick={() => setMobileOpen(false)}
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
