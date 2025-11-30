import { featureHighlights } from '@/config/marketing';
import { FeatureHighlights } from '@/components/marketing/sections/FeatureHighlights';
import { FrameworkSelector } from '@/components/marketing/interactive/FrameworkSelector';
import { FinalCTA } from '@/components/marketing/sections/FinalCTA';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata = buildMarketingMetadata({
  title: 'Features | AuditGuardX',
  description: 'Explore the AI-powered features that automate SOC 2, GDPR, HIPAA, and more.',
  path: '/features',
});

export default function FeaturesPage() {
  return (
    <div className="space-y-16 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Features</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">One platform. Twelve flagship capabilities.</h1>
          <p className="mt-4 text-base text-gray-600">
            Built with Raindrop Smart Components, WorkOS authentication, Stripe billing, ElevenLabs voice, and Cerebras
            ultra-low latency inference.
          </p>
        </div>
      </section>

      <FeatureHighlights />

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <FrameworkSelector />
        </div>
      </section>

      <FinalCTA />
    </div>
  );
}
