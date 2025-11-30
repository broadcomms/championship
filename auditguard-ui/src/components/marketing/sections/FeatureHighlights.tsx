import { featureHighlights } from '@/config/marketing';

export function FeatureHighlights() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">Platform</p>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">Powerful features for every compliance moment</h2>
          <p className="mt-3 text-base text-gray-600">
            Built with Raindrop Smart Components, Vultr infrastructure, WorkOS SSO, and Stripe billing for enterprise scaling.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {featureHighlights.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-gray-100 p-8 shadow-sm">
              <p className="text-sm uppercase tracking-wide text-blue-600">{feature.title}</p>
              <p className="mt-3 text-lg font-semibold text-gray-900">{feature.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                {feature.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
