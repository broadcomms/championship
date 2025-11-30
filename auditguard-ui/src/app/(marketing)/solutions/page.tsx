import Link from 'next/link';
import { solutionsContent } from '@/config/marketing';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata = buildMarketingMetadata({
  title: 'Solutions | AuditGuardX',
  description: 'Purpose-built playbooks for startups, enterprises, healthcare, and fintech teams.',
  path: '/solutions',
});

export default function SolutionsIndexPage() {
  const entries = Object.entries(solutionsContent);

  return (
    <div className="space-y-12 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Solutions</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">Tailored experiences for every team</h1>
          <p className="mt-4 text-base text-gray-600">
            Mix and match frameworks, industries, and team sizes. Start with a template or customize every workflow with our
            API.
          </p>
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-24 sm:px-6 lg:grid-cols-2 lg:px-8">
          {entries.map(([slug, value]) => (
            <Link key={slug} href={`/${value.slug}`} className="rounded-3xl border border-gray-100 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">{value.category}</p>
              <h2 className="mt-4 text-2xl font-bold text-gray-900">{value.title}</h2>
              <p className="mt-3 text-sm text-gray-600">{value.subtitle}</p>
              <p className="mt-4 text-xs text-blue-600">View playbook →</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
