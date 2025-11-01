"use client";

import { Suspense } from "react";
import { DnsSection } from "@/components/domain/dns/dns-section";
import { DnsSectionSkeleton } from "@/components/domain/dns/dns-section-skeleton";
import { useDnsQuery } from "@/hooks/use-domain-queries";

function DnsSectionContent({ domain }: { domain: string }) {
  const { data } = useDnsQuery(domain);
  return <DnsSection records={data.records} />;
}

export function DnsSectionWithData({ domain }: { domain: string }) {
  return (
    <Suspense fallback={<DnsSectionSkeleton />}>
      <DnsSectionContent domain={domain} />
    </Suspense>
  );
}
