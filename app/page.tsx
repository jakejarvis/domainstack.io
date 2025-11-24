import { Suspense } from "react";
import { DomainSuggestions } from "@/components/domain/domain-suggestions";
import { DomainSuggestionsSkeleton } from "@/components/domain/domain-suggestions-skeleton";
import { HomeHero } from "@/components/layout/home-hero";
import { HomeSearchSection } from "@/components/layout/home-search-section";

export default function Home() {
  return (
    <div className="container mx-auto my-auto flex items-center justify-center px-4 py-8">
      <div className="w-full space-y-6">
        <HomeHero />
        <HomeSearchSection>
          <Suspense fallback={<DomainSuggestionsSkeleton />}>
            <DomainSuggestions />
          </Suspense>
        </HomeSearchSection>
      </div>
    </div>
  );
}
