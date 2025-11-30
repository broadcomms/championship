import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://localhost:3000';
const defaultOgImage = '/og-image.svg';

interface MarketingMetadataArgs {
  title: string;
  description: string;
  path?: string;
  image?: string;
}

export function buildMarketingMetadata({ title, description, path = '/', image = defaultOgImage }: MarketingMetadataArgs): Metadata {
  const url = new URL(path, siteUrl).toString();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export function organizationStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AuditGuardX',
    url: siteUrl,
    logo: `${siteUrl}/images/logos/logo-raindrop.svg`,
    sameAs: [
      'https://www.linkedin.com/company/auditguardx',
      'https://twitter.com/auditguardx',
    ],
  };
}
