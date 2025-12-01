import { innerPageHeroes } from '@/config/marketing';
import { FeatureHighlights } from '@/components/marketing/sections/FeatureHighlights';
import { FrameworkSelector } from '@/components/marketing/interactive/FrameworkSelector';
import { FinalCTA } from '@/components/marketing/sections/FinalCTA';
import { SecondaryHero } from '@/components/marketing/heroes/SecondaryHero';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata = buildMarketingMetadata({
  title: 'Features | AuditGuardX',
  description: 'Explore the AI-powered features that automate SOC 2, GDPR, HIPAA, and more.',
  path: '/features',
});

export default function FeaturesPage() {
  const hero = innerPageHeroes.features;

  return (
    <div className="space-y-16">
      <SecondaryHero {...hero} />

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
