import Link from 'next/link';
import { ReactNode } from 'react';
import { BrandLogo } from '@/components/marketing/navigation/BrandLogo';

export type AuthHeroContent = {
  eyebrow: string;
  heading: string;
  description: string;
  bullets: string[];
};

type AuthLayoutProps = {
  children: ReactNode;
  hero: AuthHeroContent;
};

export function AuthLayout({ children, hero }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <BrandLogo variant="light" className="text-white" />
          <Link href="/" className="text-sm font-semibold text-white/80 transition hover:text-white">
            ← Back to site
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col lg:flex-row">
        <section className="relative w-full bg-gradient-to-br from-blue-600/70 via-indigo-600/70 to-slate-900/90 px-6 py-12 text-white lg:w-1/2 lg:px-10 lg:py-16">
          <div className="mx-auto max-w-md lg:max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/70">{hero.eyebrow}</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight lg:text-4xl">{hero.heading}</h1>
            <p className="mt-4 text-sm text-white/80 lg:text-base">{hero.description}</p>
            <ul className="mt-8 space-y-4 text-sm text-white/85">
              {hero.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/10 opacity-30" />
        </section>

        <section className="flex w-full items-center justify-center bg-white px-6 py-12 text-slate-900 sm:px-10 lg:w-1/2 lg:px-12">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </main>
    </div>
  );
}
