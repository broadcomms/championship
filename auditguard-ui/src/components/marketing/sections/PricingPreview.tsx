import Link from 'next/link';
import { pricingPlans } from '@/config/marketing';

export function PricingPreview() {
  return (
    <section className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">Pricing</p>
          <h2 className="mt-4 text-3xl font-bold text-gray-900">Pricing that scales with every audit stage</h2>
          <p className="mt-2 text-base text-gray-600">14-day Professional trial. Cancel anytime. No setup fees.</p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div key={plan.name} className="rounded-3xl border border-gray-100 bg-white p-8 shadow-lg">
              {plan.badge && (
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                  {plan.badge}
                </span>
              )}
              <p className="mt-4 text-sm uppercase tracking-wide text-gray-500">{plan.name}</p>
              <p className="mt-3 text-4xl font-bold text-gray-900">${plan.price}<span className="text-base font-medium text-gray-500">/mo</span></p>
              <p className="mt-3 text-sm text-gray-600">{plan.description}</p>
              <ul className="mt-6 space-y-2 text-sm text-gray-600">
                {plan.includes.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className="mt-8 inline-flex w-full items-center justify-center rounded-full border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 transition hover:border-blue-300"
              >
                {plan.highlight}
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center text-sm text-gray-500">
          <p>Need custom onboarding? <Link href="/company/contact" className="text-blue-600">Talk to our team</Link>.</p>
        </div>
      </div>
    </section>
  );
}
