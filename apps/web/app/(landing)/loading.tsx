import { HomeSearchSuggestionsSkeleton } from "@/components/search/home-search-suggestions-skeleton";
import { SearchSkeleton } from "@/components/search/search-skeleton";

export default function LandingLoading() {
  return (
    <div className="container mx-auto my-auto flex items-center justify-center px-4 py-8">
      <div className="w-full space-y-6">
        {/* Hero */}
        <h1 className="flex w-full flex-col items-center justify-center gap-y-2 text-center font-semibold text-3xl leading-none tracking-tight sm:flex-row sm:items-baseline sm:gap-y-0 sm:text-4xl md:text-5xl">
          <span className="whitespace-nowrap text-foreground/90">
            Inspect any domain&rsquo;s
          </span>
          <span className="ml-2.5 inline-flex items-center rounded-lg bg-muted/70 px-2 py-0.5 text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md sm:rounded-xl sm:px-3 sm:py-1">
            <span className="relative flex h-[1.15em] w-full items-center overflow-hidden whitespace-nowrap">
              <span className="inline-block">registration</span>
            </span>
          </span>
          <span className="hidden whitespace-nowrap text-foreground/90 sm:inline">
            .
          </span>
        </h1>

        {/* Search section skeleton */}
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <SearchSkeleton variant="lg" />
          <HomeSearchSuggestionsSkeleton />
        </div>
      </div>
    </div>
  );
}
