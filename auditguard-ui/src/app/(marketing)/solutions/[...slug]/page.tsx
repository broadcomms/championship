import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { solutionsContent } from '@/config/marketing';
import { FinalCTA } from '@/components/marketing/sections/FinalCTA';
import { buildMarketingMetadata } from '@/lib/seo';

const solutionEntries = Object.values(solutionsContent);

function findSolution(slugSegments: string[]) {
  const normalizedSlug = `solutions/${slugSegments.join('/')}`;
  return solutionEntries.find((entry) => entry.slug === normalizedSlug);
}

export function generateStaticParams() {
  return solutionEntries.map((entry) => ({ slug: entry.slug.replace('solutions/', '').split('/') }));
}

export function generateMetadata({ params }: { params: { slug: string[] } }): Metadata {
  const solution = findSolution(params.slug);
  if (!solution) {
    return { title: 'Solution not found' };
  }

  return buildMarketingMetadata({
    title: `${solution.title} | AuditGuardX Solutions`,
    description: solution.subtitle,
    path: `/${solution.slug}`,
  });
}

export default function SolutionPage({ params }: { params: { slug: string[] } }) {
  const solution = findSolution(params.slug);

  if (!solution) {
    notFound();
  }

  const entry = solution;

  return (
    <div className="space-y-16 pt-28">
      <section className="bg-gradient-to-br from-blue-50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Solutions</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">{entry.title}</h1>
          <p className="mt-4 text-base text-gray-600">{entry.subtitle}</p>
          <div className="mt-6 inline-flex gap-3">
            <Link href="/register" className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white">
              Start Free Trial
            </Link>
            <Link href="/company/contact" className="rounded-full border border-blue-200 px-6 py-3 text-sm font-semibold text-blue-700">
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="col-span-2 space-y-8">
            <div className="rounded-3xl border border-gray-100 p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">Pain points</p>
              <ul className="mt-4 space-y-3 text-base text-gray-700">
                {entry.pains.map((pain) => (
                  <li key={pain} className="flex gap-3">
                    <span className="text-blue-600">•</span>
                    <span>{pain}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-gray-100 p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">Outcomes</p>
              <ul className="mt-4 space-y-3 text-base text-gray-700">
                {entry.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-3">
                    <span className="text-green-600">✓</span>
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Customer spotlight</p>
              <p className="mt-4 text-lg font-semibold text-gray-900">“{entry.testimonial.quote}”</p>
              <p className="mt-4 text-sm text-gray-600">{entry.testimonial.author}</p>
              <p className="text-xs text-gray-500">{entry.testimonial.title}</p>
            </div>
            <div className="rounded-3xl border border-gray-100 p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">Launch kit</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>• SOC 2 / HIPAA templates</li>
                <li>• Voice mode task shortcuts</li>
                <li>• Evidence upload automations</li>
                <li>• KPI dashboard starter pack</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <FinalCTA />
    </div>
  );
}
