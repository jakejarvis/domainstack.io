"use client";

import { IconSearch } from "@tabler/icons-react";

import { AppHeaderSeparator } from "@/components/layout/app-header-separator";
import { useMobileSearch } from "@/components/layout/mobile-search-context";
import { useIsHomeRoute } from "@/hooks/use-is-home-route";
import { Button } from "@domainstack/ui/button";

/**
 * Expands the header search on mobile. Hidden from `md` up, where the input is
 * always visible, and on the landing page, which has its own search field.
 * Carries its trailing separator so both disappear together.
 */
export function MobileSearchToggle() {
  const { isOpen, open, toggleRef } = useMobileSearch();
  const isHome = useIsHomeRoute();

  if (isHome) return null;

  return (
    <>
      <Button
        ref={toggleRef}
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        aria-label="Search"
        aria-expanded={isOpen}
        aria-controls="header-search"
        onClick={open}
      >
        <IconSearch />
      </Button>
      <AppHeaderSeparator className="md:hidden" />
    </>
  );
}
