import type { Metadata } from "next";
import { Suspense } from "react";

import { AnnouncementPill } from "@/components/landing/announcement-pill";
import { HomeHero } from "@/components/landing/home-hero";
import { DomainSuggestions } from "@/components/search/home-search-suggestions";
import { HomeSearchSuggestionsSkeleton } from "@/components/search/home-search-suggestions-skeleton";
import { SearchClient } from "@/components/search/search-client";
import { buildHomeJsonLd } from "@/lib/json-ld";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  path: "/",
});

export default function LandingPage() {
  const jsonLd = buildHomeJsonLd(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000");

  return (
    <div className="container mx-auto my-auto flex items-center justify-center px-4 py-8">
      <script
        type="application/ld+json"
        // Escape `<` so the payload can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="relative w-full space-y-6">
        <AnnouncementPill />
        <HomeHero />
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <SearchClient variant="lg" />
          <Suspense fallback={<HomeSearchSuggestionsSkeleton />}>
            <DomainSuggestions />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
