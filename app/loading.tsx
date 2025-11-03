import { DomainSearchSkeleton } from "@/components/domain/domain-search-skeleton";
import { DomainSuggestionsSkeleton } from "@/components/domain/domain-suggestions-skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto my-auto flex items-center justify-center px-4 py-8">
      <div className="w-full space-y-6">
        {/* Hero skeleton */}
        <div className="flex w-full flex-col items-center justify-center gap-y-2 sm:flex-row sm:items-baseline sm:gap-y-0">
          {/* "Inspect any domain's" text */}
          <div className="h-9 w-[400px] animate-pulse rounded-lg bg-muted/30 sm:h-12 md:h-14" />
        </div>

        {/* Search section skeleton */}
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <DomainSearchSkeleton variant="lg" />
          <DomainSuggestionsSkeleton />
        </div>
      </div>
    </div>
  );
}
