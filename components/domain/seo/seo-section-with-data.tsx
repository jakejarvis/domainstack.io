"use client";

import { Suspense } from "react";
import { SeoSection } from "@/components/domain/seo/seo-section";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { useSeoQuery } from "@/hooks/use-domain-queries";

function SeoSectionContent({ domain }: { domain: string }) {
  const { data } = useSeoQuery(domain);
  return <SeoSection domain={domain} data={data} />;
}

export function SeoSectionWithData({ domain }: { domain: string }) {
  return (
    <Suspense fallback={<SeoSectionSkeleton />}>
      <SeoSectionContent domain={domain} />
    </Suspense>
  );
}
