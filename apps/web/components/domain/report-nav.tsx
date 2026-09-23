"use client";

import { useEffect, useRef } from "react";

import { Favicon } from "@/components/icons/favicon";
import type { SectionDef } from "@/lib/constants/sections";
import { Button } from "@domainstack/ui/button";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { cn } from "@domainstack/ui/utils";

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
 * Sticks below the global header. On mobile it follows the header's `data-scrolled-away`
 * with the same timing: snaps up when the header hides, slides back down with it.
 */
export function SectionNav({
  domain,
  sections,
  activeSection,
  isHeaderVisible,
  onSectionClick,
}: SectionNavProps) {
  const navRef = useRef<HTMLElement>(null);

  // scrolls only the tab strip; scrollIntoView would also touch the window and can cancel
  // the smooth page scroll a tab click just started
  useEffect(() => {
    const viewport = navRef.current?.querySelector("[data-slot=scroll-area-viewport]");
    const activeTab = navRef.current?.querySelector(`[data-section="${activeSection}"]`);
    if (!(viewport instanceof HTMLElement) || !(activeTab instanceof HTMLElement)) return;

    const tabRect = activeTab.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    viewport.scrollTo({
      left:
        viewport.scrollLeft +
        tabRect.left -
        viewportRect.left -
        (viewportRect.width - tabRect.width) / 2,
      behavior: "smooth",
    });
  }, [activeSection]);

  return (
    <nav
      ref={navRef}
      aria-label="Section navigation"
      className={cn(
        "sticky top-[var(--header-height)] z-40 -mx-4 mt-4 mb-4 px-4",
        "transition-[translate] duration-300 ease-out motion-reduce:transition-none md:transition-none",
        "max-md:[:root:has(header[data-scrolled-away=true])_&]:-translate-y-[var(--header-height)] max-md:[:root:has(header[data-scrolled-away=true])_&]:transition-none",
      )}
    >
      <div
        className={cn(
          "relative flex items-center",
          "h-[var(--section-nav-height)]",
          "before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2",
          "before:bg-background/80 before:backdrop-blur",
          "after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-screen after:-translate-x-1/2",
          "after:transition-opacity after:duration-200",
          // Solid border when scrolled, faded edges when at top (desktop only)
          isHeaderVisible
            ? "after:bg-gradient-to-r after:from-transparent after:via-black/10 after:to-transparent dark:after:via-white/10"
            : "shadow-xl shadow-black/5 after:bg-black/10 dark:shadow-none dark:after:bg-white/10",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 overflow-hidden transition duration-200 ease-out",
            isHeaderVisible ? "w-0 opacity-0" : "mr-3 w-auto border-r pr-3 opacity-100",
          )}
        >
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex min-w-0 cursor-pointer items-center gap-2"
            aria-label={`Scroll to top - ${domain}`}
          >
            <Favicon domain={domain} className="shrink-0" />
            <span className="max-w-32 truncate text-[15px] font-medium">{domain}</span>
          </button>
        </div>

        <ScrollArea
          className="flex-1 [&_[data-slot=scroll-area-viewport]]:overscroll-y-none"
          hideScrollbar
        >
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
                  "rounded-md px-3 py-1.5 text-[13px] tracking-[0.01em] whitespace-nowrap",
                  "transition duration-150",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  "hover:!bg-[color-mix(in_oklch,var(--section-accent)_15%,transparent)] hover:text-foreground",
                  activeSection === slug
                    ? "bg-[color-mix(in_oklch,var(--section-accent)_25%,transparent)] font-medium text-accent-foreground"
                    : "text-foreground/75",
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
