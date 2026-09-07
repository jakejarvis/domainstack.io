import { IconArrowLeft } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddDomainPageClient } from "@/components/dashboard/add-domain/add-domain-page-client";
import { AddDomainSkeleton } from "@/components/dashboard/add-domain/add-domain-skeleton";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  path: "/dashboard/add-domain",
  title: "Add Domain",
  description: "Add a domain to track registration, DNS, SSL, and hosting changes.",
  robots: {
    index: false,
    follow: false,
  },
});

async function AddDomainPrefill({
  searchParams,
}: {
  searchParams: Promise<{
    domain?: string;
    resume?: string;
    id?: string;
    method?: string;
  }>;
}) {
  const params = await searchParams;
  return <AddDomainPageClient prefillDomain={params.domain} />;
}

export default function AddDomainPage({
  searchParams,
}: {
  searchParams: Promise<{
    domain?: string;
    resume?: string;
    id?: string;
    method?: string;
  }>;
}) {
  return (
    <div className="mx-auto my-auto flex w-full max-w-lg flex-col">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        Back to dashboard
      </Link>
      <Suspense fallback={<AddDomainSkeleton />}>
        <AddDomainPrefill searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
