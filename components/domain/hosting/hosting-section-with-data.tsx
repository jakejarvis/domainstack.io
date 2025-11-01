"use client";

import { Suspense } from "react";
import { HostingSection } from "@/components/domain/hosting/hosting-section";
import { HostingSectionSkeleton } from "@/components/domain/hosting/hosting-section-skeleton";
import { useHostingQuery } from "@/hooks/use-domain-queries";

function HostingSectionContent({ domain }: { domain: string }) {
  const { data } = useHostingQuery(domain);
  return <HostingSection data={data} />;
}

export function HostingSectionWithData({ domain }: { domain: string }) {
  return (
    <Suspense fallback={<HostingSectionSkeleton />}>
      <HostingSectionContent domain={domain} />
    </Suspense>
  );
}
