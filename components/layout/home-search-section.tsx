"use client";

import { useCallback, useState } from "react";
import { DomainSearch } from "@/components/domain/domain-search";
import { HomeSearchProvider } from "@/components/layout/home-search-context";
import type { Source } from "@/hooks/use-domain-search";

type NavigationTrigger = {
  domain: string;
  source: Source;
};

/**
 * Client wrapper that coordinates between the search box and suggestions.
 *
 * This component manages the interaction when a suggestion is clicked:
 * - Updates the search input value
 * - Shows loading state
 * - Triggers navigation
 *
 * Accepts server components (like DomainSuggestionsServer) as children.
 */
export function HomeSearchSection({ children }: { children: React.ReactNode }) {
  const [domainToNavigate, setDomainToNavigate] =
    useState<NavigationTrigger | null>(null);

  const handleSuggestionClick = useCallback((domain: string) => {
    setDomainToNavigate({ domain, source: "suggestion" });
  }, []);

  const handleNavigationComplete = useCallback(() => {
    setDomainToNavigate(null);
  }, []);

  return (
    <HomeSearchProvider onSuggestionClick={handleSuggestionClick}>
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <DomainSearch
          variant="lg"
          externalNavigation={domainToNavigate}
          onNavigationCompleteAction={handleNavigationComplete}
        />
        {children}
      </div>
    </HomeSearchProvider>
  );
}
