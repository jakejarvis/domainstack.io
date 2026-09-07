import { IconArrowLeft } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddDomainPageClient } from "@/components/dashboard/add-domain/add-domain-page-client";
import { AddDomainSkeleton } from "@/components/dashboard/add-domain/add-domain-skeleton";
import { createMetadata } from "@/lib/seo";
import { Card } from "@domainstack/ui/card";

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
}: Pick<PageProps<"/dashboard/add-domain">, "searchParams">) {
  const { domain } = await searchParams;
  return <AddDomainPageClient prefillDomain={Array.isArray(domain) ? domain[0] : domain} />;
}

export default function AddDomainPage({ searchParams }: PageProps<"/dashboard/add-domain">) {
  return (
    <div className="mx-auto my-auto flex w-full max-w-lg flex-col">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        Back to dashboard
      </Link>
      <Suspense
        fallback={
          <Card className="w-full px-6">
            <AddDomainSkeleton />
          </Card>
        }
      >
        <AddDomainPrefill searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
