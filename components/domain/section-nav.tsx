"use client";

import { useEffect, useRef } from "react";
import { Favicon } from "@/components/icons/favicon";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import type { SectionDef } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SectionNavProps {
  domain: string;
  sections: SectionDef[];
  activeSection: string;
  isHeaderVisible: boolean;
  onSectionClick: (slug: string) => void;
}

/**
 * Sticky section navigation bar with "context injection" pattern.
 * When the page header scrolls out of view, the domain name and track button
 * fade into the left side of the nav bar.
 *
 * Desktop: Sticks below global header (always visible)
 * Mobile: Adjusts position based on global header visibility (scroll direction)
 */
export function SectionNav({
  domain,
  sections,
  activeSection,
  isHeaderVisible,
  onSectionClick,
}: SectionNavProps) {
  const navRef = useRef<HTMLElement>(null);
  // offsetThreshold defaults to HEADER_HEIGHT from layout constants
  const { direction, isPastThreshold } = useScrollDirection({
    threshold: 15,
  });

  // On mobile past threshold: header hidden when scrolling down, visible when up
  const isGlobalHeaderHidden = isPastThreshold && direction === "down";

  // Auto-scroll active tab into view
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const activeTab = nav.querySelector(`[data-section="${activeSection}"]`);
    if (!(activeTab instanceof HTMLElement)) return;

    // Simple: just scroll the button into view, centered
    activeTab.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeSection]);

  return (
    <nav
      ref={navRef}
      aria-label="Section navigation"
      className={cn(
        "sticky z-40 -mx-4 mt-4 mb-4 px-4",
        // Mobile: position follows header visibility
        // Before threshold: stick to top naturally (global header scrolls away)
        // Past threshold: transition between top-0 (header hidden) and header height (header visible)
        isPastThreshold
          ? isGlobalHeaderHidden
            ? "top-0 transition-[top] duration-300 ease-out"
            : "top-[var(--header-height,80px)] transition-[top] duration-300 ease-out"
          : "top-0",
        // Desktop: always below sticky global header (no mobile behavior)
        "md:!top-[var(--header-height,80px)] md:!transition-none",
      )}
    >
      <div
        className={cn(
          "relative flex items-center",
          "h-[var(--section-nav-height,48px)]",
          // Full-width background using pseudo-element
          "before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2",
          "before:bg-background/80 before:backdrop-blur",
          // Full-width bottom border using pseudo-element
          "after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-screen after:-translate-x-1/2",
          "after:transition-opacity after:duration-200",
          // Solid border when scrolled, faded edges when at top (desktop only)
          isHeaderVisible
            ? "after:bg-gradient-to-r after:from-transparent after:via-black/10 after:to-transparent dark:after:via-white/10"
            : "shadow-black/5 shadow-xl after:bg-black/10 dark:shadow-none dark:after:bg-white/10",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 overflow-hidden",
            "transition-all duration-200 ease-out",
            isHeaderVisible
              ? "w-0 opacity-0"
              : "mr-3 w-auto border-black/10 border-r pr-3 opacity-100 dark:border-white/10",
          )}
        >
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex min-w-0 cursor-pointer items-center gap-2"
          >
            <Favicon domain={domain} size={16} className="shrink-0" />
            <span className="max-w-32 truncate font-medium text-[15px]">
              {domain}
            </span>
          </button>
        </div>

        {/* Section tabs - horizontally scrollable with gradient indicators */}
        <ScrollArea showScrollbar={false} className="flex-1">
          <div className="flex items-center gap-1 px-1 md:justify-center">
            {sections.map(({ slug, title, icon: Icon, accent }) => (
              <Button
                key={slug}
                data-section={slug}
                data-accent={accent}
                variant="ghost"
                size="sm"
                onClick={() => onSectionClick(slug)}
                aria-current={activeSection === slug ? "page" : undefined}
                style={
                  {
                    "--section-accent": `var(--accent-${accent})`,
                  } as React.CSSProperties
                }
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] tracking-[0.01em]",
                  "transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "hover:!bg-[color-mix(in_oklch,var(--section-accent)_15%,transparent)] hover:text-foreground",
                  activeSection === slug
                    ? "bg-[color-mix(in_oklch,var(--section-accent)_25%,transparent)] font-medium text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {title}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </nav>
  );
}
