import { MarketingHeader } from '@/components/marketing/navigation/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/navigation/MarketingFooter';

interface MarketingPageLayoutProps {
  children: React.ReactNode;
}

export function MarketingPageLayout({ children }: MarketingPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <MarketingHeader />
      <main className="pt-20">{children}</main>
      <MarketingFooter />
    </div>
  );
}
