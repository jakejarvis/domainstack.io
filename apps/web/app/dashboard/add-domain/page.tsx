import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Suspense } from "react";
import { AddDomainPageClient } from "@/components/dashboard/add-domain/add-domain-page-client";
import { AddDomainSkeleton } from "@/components/dashboard/add-domain/add-domain-skeleton";

export default async function AddDomainPage({
  searchParams,
}: {
  searchParams: Promise<{
    domain?: string;
    resume?: string;
    id?: string;
    method?: string;
  }>;
}) {
  // Extract domain query param on server
  const params = await searchParams;
  const prefillDomain = params.domain;

  return (
    <div className="mx-auto my-auto flex w-full max-w-lg flex-col">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to dashboard
      </Link>
      <Suspense fallback={<AddDomainSkeleton />}>
        <AddDomainPageClient prefillDomain={prefillDomain} />
      </Suspense>
    </div>
  );
}
