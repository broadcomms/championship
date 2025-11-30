import { PricingPreview } from '@/components/marketing/sections/PricingPreview';
import { ComparisonTable } from '@/components/marketing/sections/ComparisonTable';
import { ROICalculator } from '@/components/marketing/sections/ROICalculator';
import { FAQAccordion } from '@/components/marketing/sections/FAQAccordion';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata = buildMarketingMetadata({
  title: 'Pricing | AuditGuardX',
  description: 'Simple transparent pricing for AI-powered compliance automation.',
  path: '/pricing',
});

export default function PricingPage() {
  return (
    <div className="space-y-16 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Pricing</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">Simple, transparent pricing</h1>
          <p className="mt-4 text-base text-gray-600">
            Choose the plan that matches your compliance runway. Upgrade, downgrade, or cancel anytime. Every plan includes a
            14-day Professional trial.
          </p>
        </div>
      </section>

      <PricingPreview />

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="items-start rounded-[40px] bg-gray-50/60 p-6 shadow-inner shadow-gray-100 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-10 lg:p-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Compare</p>
                <h2 className="text-3xl font-bold text-gray-900">AuditGuardX vs. legacy compliance providers</h2>
                <p className="text-sm text-gray-600">
                  Benchmarks pulled from analyst reports and public pricing pages of Vanta, Drata, and Big 4 consultants. We win on price,
                  coverage, and speed.
                </p>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <p className="font-semibold text-gray-900">Transparent pricing</p>
                  <p className="text-gray-600">Flat monthly plans with 14-day Professional trial and no hidden onboarding fees.</p>
                </li>
                <li className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <p className="font-semibold text-gray-900">Full-stack automation</p>
                  <p className="text-gray-600">Voice AI assistant, evidence automation, and remediation workflows included.</p>
                </li>
                <li className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <p className="font-semibold text-gray-900">Enterprise readiness</p>
                  <p className="text-gray-600">WorkOS SSO, Stripe billing, and global Vultr infrastructure deliver 99.9% uptime.</p>
                </li>
              </ul>
            </div>
            <div className="mt-8 lg:mt-0">
              <ComparisonTable />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <ROICalculator />
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Questions</p>
            <h2 className="mt-4 text-3xl font-bold text-gray-900">Frequently asked</h2>
            <p className="mt-4 text-base text-gray-600">
              Still need answers? Email <span className="font-semibold text-blue-600">sales@auditguardx.com</span> and we’ll
              reply within one business day.
            </p>
          </div>
          <FAQAccordion />
        </div>
      </section>
    </div>
  );
}
