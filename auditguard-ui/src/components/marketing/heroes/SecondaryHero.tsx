import Link from 'next/link';

interface SupportingPoint {
  label: string;
  description: string;
}

interface HeroMetric {
  label: string;
  value: string;
  detail?: string;
}

interface HeroCallout {
  label: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export interface SecondaryHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  note?: string;
  supporting?: SupportingPoint[];
  metrics?: HeroMetric[];
  callout?: HeroCallout;
}

export function SecondaryHero({
  eyebrow,
  title,
  description,
  note,
  supporting = [],
  metrics = [],
  callout,
}: SecondaryHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-white via-blue-50/60 to-blue-100/40 pt-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-blue-100/70 via-transparent to-transparent" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-blue-200/50 blur-[140px]" />
      <div className="pointer-events-none absolute -left-16 top-16 hidden h-56 w-56 rounded-full bg-indigo-100/50 blur-[160px] lg:block" />

      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-20 sm:px-6 lg:flex-row lg:items-start lg:px-8">
        <div className="flex-1 space-y-6 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">{eyebrow}</p>
          <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">{title}</h1>
          <p className="text-lg text-slate-600 sm:text-xl">{description}</p>

          {supporting.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {supporting.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-blue-100/80 bg-white/90 p-4 shadow-sm shadow-blue-100/50"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-500">{item.label}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          )}

          {note && (
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {note}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="relative rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_35px_80px_rgba(15,23,42,0.08)]">
            <div className="absolute -top-6 right-6 hidden rounded-full border border-white/70 bg-gradient-to-r from-blue-600 to-purple-500 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white shadow-lg md:block">
              {eyebrow}
            </div>

            {metrics.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900">{metric.value}</p>
                    {metric.detail && <p className="text-xs text-slate-500">{metric.detail}</p>}
                  </div>
                ))}
              </div>
            )}

            {callout && (
              <div className="mt-6 rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-500 p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">{callout.label}</p>
                <p className="mt-2 text-lg font-semibold leading-snug">{callout.title}</p>
                <p className="mt-2 text-sm text-white/80">{callout.description}</p>
                {callout.action && (
                  <Link
                    href={callout.action.href}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-white/80"
                  >
                    {callout.action.label}
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
