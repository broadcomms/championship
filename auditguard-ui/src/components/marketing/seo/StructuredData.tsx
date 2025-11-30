"use client";

import { useId } from 'react';
import Script from 'next/script';

interface StructuredDataProps {
  data: Record<string, unknown>;
}

export function StructuredData({ data }: StructuredDataProps) {
  const scriptId = useId();

  if (!data) {
    return null;
  }

  return (
    <Script
      id={`structured-data-${scriptId}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
