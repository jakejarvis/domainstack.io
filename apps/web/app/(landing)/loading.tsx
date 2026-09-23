import { HomeSearchSuggestionsSkeleton } from "@/components/search/home-search-suggestions-skeleton";
import { SearchSkeleton } from "@/components/search/search-skeleton";

export default function LandingLoading() {
  return (
    <div className="container mx-auto my-auto flex items-center justify-center px-4 py-8">
      <div className="relative w-full space-y-6">
        <h1 className="flex w-full flex-col items-center justify-center gap-y-2 text-center text-3xl leading-none font-semibold tracking-tight sm:flex-row sm:items-baseline sm:gap-y-0 sm:text-4xl md:text-5xl">
          <span className="whitespace-nowrap text-foreground/90">Inspect any domain&rsquo;s</span>{" "}
          <span className="sr-only">
            registration, DNS records, hosting, email, SEO, certificates, and more.
          </span>
          <span
            className="relative inline-flex items-center px-2 py-0.5 text-foreground sm:ml-2.5 sm:px-3 sm:py-1"
            aria-hidden
          >
            {/* the hero's three-sliced pill, at rest */}
            <span className="absolute -inset-px rounded-lg border border-ring/20 bg-muted/40 shadow-[0_1px_0_rgb(0_0_0/0.05)] sm:rounded-md" />
            <span className="relative flex h-[1.15em] w-full items-center overflow-hidden whitespace-nowrap">
              <span className="inline-block before:content-['registration']" />
            </span>
          </span>
          <span
            className="hidden whitespace-nowrap text-foreground/90 before:content-['.'] sm:inline-block"
            aria-hidden
          />
        </h1>

        <div className="mx-auto w-full max-w-3xl space-y-5">
          <SearchSkeleton variant="lg" />
          <HomeSearchSuggestionsSkeleton />
        </div>
      </div>
    </div>
  );
}
