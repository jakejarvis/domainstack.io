"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { useHeaderSearchFocus } from "@/components/search/header-search-context";
import { SearchClient } from "@/components/search/search-client";

export function HeaderSearchClient() {
  const { setIsSearchFocused } = useHeaderSearchFocus();
  const segment = useSelectedLayoutSegment();
  const isHome = segment === null || segment === "(home)";

  // Return empty div to avoid messing up header grid layout
  // We use useSelectedLayoutSegment instead of usePathname because it correctly
  // reflects the 'children' slot state even when intercepted routes (like /settings)
  // are active in the modal slot.
  if (isHome) return <div className="flex flex-1" />;

  return (
    <div className="flex flex-1 justify-center">
      <div className="w-full max-w-2xl">
        <SearchClient variant="sm" onFocusChangeAction={setIsSearchFocused} />
      </div>
    </div>
  );
}
