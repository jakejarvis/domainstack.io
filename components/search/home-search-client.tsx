"use client";

import { useCallback, useState } from "react";
import { HomeSearchProvider } from "@/components/search/home-search-context";
import { SearchClient } from "@/components/search/search-client";

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
export function HomeSearchClient({ children }: { children: React.ReactNode }) {
  const [domainToNavigate, setDomainToNavigate] = useState<string | null>(null);

  const handleSuggestionClick = useCallback((domain: string) => {
    setDomainToNavigate(domain);
  }, []);

  const handleNavigationComplete = useCallback(() => {
    setDomainToNavigate(null);
  }, []);

  return (
    <HomeSearchProvider onSuggestionClick={handleSuggestionClick}>
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <SearchClient
          variant="lg"
          value={domainToNavigate}
          onNavigationCompleteAction={handleNavigationComplete}
        />
        {children}
      </div>
    </HomeSearchProvider>
  );
}
