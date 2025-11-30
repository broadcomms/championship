import Link from 'next/link';
import Image from 'next/image';
import { heroContent } from '@/config/marketing';

interface PrimaryHeroProps {
  eyebrow?: string;
  heading?: string;
  description?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  trustBadge?: string;
}

export function PrimaryHero({
  eyebrow = heroContent.eyebrow,
  heading = heroContent.heading,
  description = heroContent.description,
  primaryCta = heroContent.primaryCta,
  secondaryCta = heroContent.secondaryCta,
  trustBadge = heroContent.trustBadge,
}: PrimaryHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-100 pt-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-24 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <div className="flex-1 space-y-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl lg:text-6xl">
            {heading}
          </h1>
          <p className="text-lg text-gray-600 sm:text-xl">{description}</p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href={primaryCta.href}
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-xl shadow-blue-600/30 transition hover:bg-blue-700"
            >
              {primaryCta.label}
            </Link>
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-8 py-3 text-base font-semibold text-blue-700 transition hover:border-blue-300"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600">
              ✓
            </span>
            {trustBadge}
          </div>
        </div>

        <div className="flex-1">
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/90 p-6 shadow-2xl backdrop-blur">
            <Image
              src="/images/marketing/hero-dashboard.svg"
              alt="AuditGuardX compliance overview"
              width={800}
              height={520}
              priority
              className="w-full rounded-2xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 via-transparent to-transparent" aria-hidden />
            <div className="pointer-events-none absolute inset-0 p-6 text-white">
              <div className="flex w-full justify-between text-xs text-white/70">
                <p>Live Compliance Overview</p>
                <p>Updated 90s ago</p>
              </div>
            </div>
          </div>
          <div className="relative z-10 -mt-12 rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <div className="flex w-full justify-between text-xs text-gray-500">
              <p>Live Compliance Overview</p>
              <p>Updated 90s ago</p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[72, 98, 14, 22].map((value, index) => (
                <div key={value} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {['Evidence Ready', 'Audit Confidence', 'Frameworks', 'Voice Tools'][index]}
                  </p>
                  <p className="mt-3 text-3xl font-bold text-gray-900">
                    {index === 1 ? `${value}%` : value}
                  </p>
                  <p className="text-xs text-gray-500">{['documents', 'accuracy', 'supported', 'specialized'][index]}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
              <p className="text-sm uppercase tracking-wide text-white/70">Voice Mode</p>
              <p className="mt-2 text-lg font-semibold">“SOC 2 evidence for access controls?”</p>
              <p className="text-sm text-white/80">Answer in 0.12 seconds • 3 citations</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
