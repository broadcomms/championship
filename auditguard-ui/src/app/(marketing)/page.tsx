import { PrimaryHero } from '@/components/marketing/heroes/PrimaryHero';
import { LogoGrid } from '@/components/marketing/sections/LogoGrid';
import { ValueProps } from '@/components/marketing/sections/ValueProps';
import { VideoShowcase } from '@/components/marketing/sections/VideoShowcase';
import { FeatureHighlights } from '@/components/marketing/sections/FeatureHighlights';
import { PricingPreview } from '@/components/marketing/sections/PricingPreview';
import { FinalCTA } from '@/components/marketing/sections/FinalCTA';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata = buildMarketingMetadata({
  title: 'AuditGuardX | AI-Powered Compliance Automation',
  description:
    'Enterprise-grade compliance automation at startup-friendly prices. Automate SOC 2, GDPR, HIPAA, and 17+ frameworks with AI-powered document intelligence.',
  path: '/',
});

export default function MarketingHomePage() {
  return (
    <div className="space-y-0">
      <PrimaryHero />
      <LogoGrid />
      <ValueProps />
      <VideoShowcase />
      <FeatureHighlights />
      {/* <StatsShowcase /> */}
     {/* <TestimonialShowcase /> */}
      <PricingPreview />
      <FinalCTA />
    </div>
  );
}
