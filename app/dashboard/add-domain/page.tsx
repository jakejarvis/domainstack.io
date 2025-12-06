"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import { Skeleton } from "@/components/ui/skeleton";

function AddDomainPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Support ?domain= query param for prefill
  const prefillDomain = searchParams.get("domain") ?? undefined;

  const handleClose = () => {
    router.push("/dashboard");
  };

  const handleSuccess = () => {
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-lg">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
        <AddDomainContent
          showCard
          className="w-full"
          onClose={handleClose}
          onSuccess={handleSuccess}
          prefillDomain={prefillDomain}
        />
      </div>
    </div>
  );
}

export default function AddDomainPage() {
  return (
    <Suspense fallback={<AddDomainSkeleton />}>
      <AddDomainPageContent />
    </Suspense>
  );
}

function AddDomainSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6">
        {/* Header */}
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        {/* Stepper skeleton */}
        <div className="flex items-center justify-between pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              {i < 3 && <Skeleton className="mx-2 h-px flex-1" />}
            </div>
          ))}
        </div>
        {/* Content area */}
        <div className="mt-6 min-h-[280px] space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Footer */}
        <div className="mt-4 flex justify-end border-t pt-4">
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}
