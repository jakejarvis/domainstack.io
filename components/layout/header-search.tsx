"use client";

import { usePathname } from "next/navigation";
import { DomainSearch } from "@/components/domain/domain-search";
import { useHeaderSearchFocus } from "@/components/layout/header-search-context";

export function HeaderSearch() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { setIsSearchFocused } = useHeaderSearchFocus();

  // Return empty div to avoid messing up header grid layout
  if (isHome) return <div />;

  return (
    <div className="flex flex-1 justify-center">
      <div className="w-full max-w-2xl">
        <DomainSearch variant="sm" onFocusChangeAction={setIsSearchFocused} />
      </div>
    </div>
  );
}
