"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { DomainSearch } from "@/components/domain/domain-search";
import { useHeaderSearchFocus } from "@/components/layout/header-search-context";

export function HeaderSearch() {
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
        <DomainSearch variant="sm" onFocusChangeAction={setIsSearchFocused} />
      </div>
    </div>
  );
}
