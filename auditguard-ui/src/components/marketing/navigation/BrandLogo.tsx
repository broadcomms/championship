"use client";

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  href?: string;
  className?: string;
  subtitle?: string;
  variant?: 'light' | 'dark';
  hideSubtitle?: boolean;
}

export function BrandLogo({
  href = '/',
  className,
  subtitle,
  variant = 'dark',
  hideSubtitle = false,
}: BrandLogoProps) {
  const content = (
    <div className={cn('flex items-center gap-3', className)}>
      <ShieldCheck className={cn('h-8 w-8', variant === 'light' ? 'text-white' : 'text-blue-600')} />
      <div className="leading-tight">
        <p className={cn('text-lg font-semibold', variant === 'light' ? 'text-white' : 'text-gray-900')}>
          AuditGuardX
        </p>
        {!hideSubtitle && subtitle && (
          <p className={cn('text-xs', variant === 'light' ? 'text-white/70' : 'text-gray-500')}>{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex items-center gap-3" aria-label="AuditGuardX homepage">
      {content}
    </Link>
  );
}
