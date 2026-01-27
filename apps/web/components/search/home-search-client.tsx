"use client";

import { SearchClient } from "@/components/search/search-client";

/**
 * Client wrapper for the homepage search.
 * Renders the search input and accepts server components as children (suggestions).
 */
export function HomeSearchClient({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <SearchClient variant="lg" />
      {children}
    </div>
  );
}
