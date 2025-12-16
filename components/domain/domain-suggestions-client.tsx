"use client";

import { X } from "lucide-react";
import { useMemo, useRef } from "react";
import { Favicon } from "@/components/domain/favicon";
import { useHomeSearch } from "@/components/layout/home-search-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDomainHistory } from "@/hooks/use-domain-history";
import { useRouter } from "@/hooks/use-router";
import { useScrollIndicators } from "@/hooks/use-scroll-indicators";
import { useAnalytics } from "@/lib/analytics/client";
import { MAX_HISTORY_ITEMS } from "@/lib/constants/app";
import { cn } from "@/lib/utils";

export type DomainSuggestionsClientProps = {
  defaultSuggestions: string[];
  className?: string;
  faviconSize?: number;
  max?: number;
};

export function DomainSuggestionsClient({
  defaultSuggestions,
  className,
  faviconSize = 16,
  max = MAX_HISTORY_ITEMS,
}: DomainSuggestionsClientProps) {
  const router = useRouter();
  const analytics = useAnalytics();
  const { onSuggestionClick } = useHomeSearch();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { history, isHistoryLoaded, clearHistory } = useDomainHistory();
  const { showStart, showEnd, update } = useScrollIndicators({
    containerRef: scrollContainerRef,
    direction: "horizontal",
  });

  const displayedSuggestions = useMemo(() => {
    const merged = [
      ...history,
      ...defaultSuggestions.filter((d) => !history.includes(d)),
    ];
    return merged.slice(0, max);
  }, [history, defaultSuggestions, max]);

  function handleClick(domain: string) {
    analytics.track("search_suggestion_clicked", {
      domain,
      source: "suggestion",
    });
    if (onSuggestionClick) {
      onSuggestionClick(domain);
      return;
    }
    router.push(`/${encodeURIComponent(domain)}`);
  }

  function handleClearHistory() {
    clearHistory();
    analytics.track("search_history_cleared");

    // Scroll back to the left with smooth animation
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: 0,
        behavior: "smooth",
      });
      // Manually update indicators after scroll
      update();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollContainerRef}
        className="scrollbar-hide overflow-x-auto py-0.5"
      >
        <div className="flex gap-2">
          {(isHistoryLoaded ? displayedSuggestions : defaultSuggestions).map(
            (domain) => (
              <Button
                key={domain}
                variant="secondary"
                size="sm"
                className={cn(
                  "shrink-0 bg-muted/15 px-2.5 ring-1 ring-border/60 hover:bg-muted/50 dark:bg-muted/70 dark:hover:bg-muted/90",
                  "first-of-type:ml-[1px]",
                  isHistoryLoaded ? "visible" : "invisible",
                )}
                onClick={(e) => {
                  e.preventDefault();
                  handleClick(domain);
                }}
                asChild
              >
                <a
                  href={`/${encodeURIComponent(domain)}`}
                  className="inline-flex items-center gap-2"
                >
                  <Favicon
                    domain={domain}
                    size={faviconSize}
                    className="pointer-events-none size-4 shrink-0 rounded"
                  />
                  {domain}
                </a>
              </Button>
            ),
          )}
          {isHistoryLoaded && history.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleClearHistory}
                  className="flex-shrink-0"
                  aria-label="Clear history"
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear history</TooltipContent>
            </Tooltip>
          ) : (
            <div className="w-[1px] flex-shrink-0" />
          )}
        </div>
      </div>
      {/* Left gradient - shown when scrolled right from start */}
      {showStart && (
        <div className="pointer-events-none absolute top-0 left-0 h-full w-12 bg-gradient-to-r from-background to-transparent" />
      )}
      {/* Right gradient - shown when more content available */}
      {showEnd && (
        <div className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-background to-transparent" />
      )}
    </div>
  );
}
