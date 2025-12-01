import Link from 'next/link';
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
  const heroMetrics = [
    { label: 'Evidence Ready', value: '72', detail: 'documents' },
    { label: 'Audit Confidence', value: '98%', detail: 'accuracy' },
    { label: 'Frameworks', value: '20+', detail: 'supported' },
    { label: 'Voice Tools', value: '22', detail: 'specialized' },
  ];

  const heroFrameworks = [
    { name: 'SOC 2', region: 'North America' },
    { name: 'HIPAA', region: 'Healthcare' },
    { name: 'ISO 27001', region: 'International' },
    { name: 'GDPR', region: 'Europe' },
    { name: 'PCI-DSS', region: 'Payment Card' },
    { name: 'SOX', region: 'US Federal' },
    { name: '+17 More Standards', region: 'Information Security & Privacy' },
  ];

  const signalTiles = [
    { label: 'Controls cleared', value: '128', sublabel: 'This quarter' },
    { label: 'Real-time alerts', value: '42', sublabel: 'Active automations' },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50 to-blue-100 pt-24">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[120%] -translate-x-1/2 rounded-full bg-white/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-10 h-72 w-72 rounded-full bg-blue-200/40 blur-[120px]" />
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 pb-24 pt-12 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <div className="flex-1 space-y-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
            {heading}
          </h1>
          <p className="text-lg text-slate-600 sm:text-xl">{description}</p>
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
          <div className="hidden flex-wrap gap-3 sm:flex">
            {heroFrameworks.map((framework) => (
              <div
                key={framework.name}
                className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-left shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-400">{framework.name}</p>
                <p className="mt-1 text-xs text-slate-500">{framework.region}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="relative">
            <div className="rounded-[32px] border border-white/70 bg-gradient-to-br from-blue-600 via-indigo-500 to-blue-400 p-6 text-white shadow-[0_40px_80px_rgba(59,7,142,0.25)]">
              <div className="flex items-start justify-between text-xs uppercase tracking-[0.35em] text-white/70">
                <p>Compliance overview</p>
                <p>Updated 90s ago</p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {signalTiles.map((tile) => (
                  <div key={tile.label} className="rounded-2xl border border-white/30 bg-white/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/70">{tile.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{tile.value}</p>
                    <p className="text-xs text-white/80">{tile.sublabel}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-white/20 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/70">Live timeline</p>
                <div className="mt-3 h-24 rounded-xl bg-gradient-to-r from-white/40 via-white/10 to-white/40" />
              </div>
            </div>

            <div className="relative z-10 -mt-16 rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_30px_70px_rgba(15,23,42,0.08)]">
              <div className="flex w-full justify-between text-xs text-slate-500">
                <p>Live Compliance Overview</p>
                <p>Synced a moment ago</p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {heroMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900">{metric.value}</p>
                    <p className="text-xs text-slate-500">{metric.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-slate-100 bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white lg:p-6">
                <p className="text-sm uppercase tracking-wide text-white/70">Next Task</p>
                <p className="mt-2 text-lg font-semibold">Share readiness snapshot with auditors</p>
                <p className="text-sm text-white/80">Auto-export ready • SOC 2 Type II</p>
                <div className="mt-4 grid gap-4 text-xs text-white/80 sm:grid-cols-3">
                  <div>
                    <p className="uppercase tracking-[0.25em] text-white/60">Owner</p>
                    <p className="mt-1 font-semibold text-white">Security Ops</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.25em] text-white/60">ETA</p>
                    <p className="mt-1 font-semibold text-white">3h</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.25em] text-white/60">Status</p>
                    <p className="mt-1 font-semibold text-white">Auto-running</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
