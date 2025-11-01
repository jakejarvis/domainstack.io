"use client";

import { Suspense } from "react";
import { HeadersSection } from "@/components/domain/headers/headers-section";
import { HeadersSectionSkeleton } from "@/components/domain/headers/headers-section-skeleton";
import { useHeadersQuery } from "@/hooks/use-domain-queries";

function HeadersSectionContent({ domain }: { domain: string }) {
  const { data } = useHeadersQuery(domain);
  return <HeadersSection data={data} />;
}

export function HeadersSectionWithData({ domain }: { domain: string }) {
  return (
    <Suspense fallback={<HeadersSectionSkeleton />}>
      <HeadersSectionContent domain={domain} />
    </Suspense>
  );
}
