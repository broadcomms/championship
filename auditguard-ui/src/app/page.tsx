import MarketingHomePage, { metadata as marketingMetadata } from './(marketing)/page';
import { MarketingPageLayout } from '@/components/marketing/layout/MarketingPageLayout';

export const metadata = marketingMetadata;

export default function Home() {
	return (
		<MarketingPageLayout>
			<MarketingHomePage />
		</MarketingPageLayout>
	);
}
