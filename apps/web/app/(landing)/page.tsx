import { Suspense } from "react";
import { AnnouncementPill } from "@/components/landing/announcement-pill";
import { HomeHero } from "@/components/landing/home-hero";
import { HomeSearchClient } from "@/components/search/home-search-client";
import { DomainSuggestions } from "@/components/search/home-search-suggestions";
import { HomeSearchSuggestionsSkeleton } from "@/components/search/home-search-suggestions-skeleton";

export default function LandingPage() {
  return (
    <div className="container mx-auto my-auto flex items-center justify-center px-4 py-8">
      <div className="relative w-full space-y-6">
        <AnnouncementPill />
        <HomeHero />
        <HomeSearchClient>
          <Suspense fallback={<HomeSearchSuggestionsSkeleton />}>
            <DomainSuggestions />
          </Suspense>
        </HomeSearchClient>
      </div>
    </div>
  );
}
