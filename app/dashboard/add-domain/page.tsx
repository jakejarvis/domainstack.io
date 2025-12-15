import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AddDomainPageClient } from "@/components/dashboard/add-domain/add-domain-page-client";
import { AddDomainSkeleton } from "@/components/dashboard/add-domain/add-domain-skeleton";

export default async function AddDomainPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  // Extract domain query param on server
  const params = await searchParams;
  const prefillDomain = params.domain;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-lg">
        <Link
          href="/dashboard"
          prefetch={false}
          className="mb-4 inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
        <Suspense fallback={<AddDomainSkeleton />}>
          <AddDomainPageClient prefillDomain={prefillDomain} />
        </Suspense>
      </div>
    </div>
  );
}
