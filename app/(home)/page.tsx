import { Suspense } from "react";
import { DomainSuggestions } from "@/components/domain/domain-suggestions";
import { DomainSuggestionsSkeleton } from "@/components/domain/domain-suggestions-skeleton";
import { AnnouncementPill } from "@/components/layout/announcement-pill";
import { HomeHero } from "@/components/layout/home-hero";
import { HomeSearchSection } from "@/components/layout/home-search-section";

export default function Home() {
  return (
    <div className="container relative mx-auto my-auto flex items-center justify-center px-4 py-8">
      {/* Announcement pill floats above content without affecting layout */}
      <AnnouncementPill />
      <div className="w-full space-y-6 pt-10">
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
