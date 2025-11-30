import type { ReactNode } from 'react';
import { MarketingPageLayout } from '@/components/marketing/layout/MarketingPageLayout';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingPageLayout>{children}</MarketingPageLayout>;
}
