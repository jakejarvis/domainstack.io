"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Favicon } from "@/components/favicon";
import { useHomeSearch } from "@/components/home-search-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDomainHistory } from "@/hooks/use-domain-history";
import { useRouter } from "@/hooks/use-router";
import { captureClient } from "@/lib/analytics/client";
import { MAX_HISTORY_ITEMS } from "@/lib/constants";
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
  const { onSuggestionClickAction } = useHomeSearch();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const updateGradientsRef = useRef<(() => void) | null>(null);

  const { history, isHistoryLoaded, clearHistory } = useDomainHistory();
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(false);

  const displayedSuggestions = useMemo(() => {
    const merged = [
      ...history,
      ...defaultSuggestions.filter((d) => !history.includes(d)),
    ];
    return merged.slice(0, max);
  }, [history, defaultSuggestions, max]);

  // Set up scroll and resize observers once on mount
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateGradients = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;

      // Show left gradient if scrolled right from the start
      setShowLeftGradient(scrollLeft > 0);

      // Show right gradient if not scrolled to the end
      // Adding a small threshold (1px) for rounding errors
      setShowRightGradient(scrollLeft < scrollWidth - clientWidth - 1);
    };

    updateGradientsRef.current = updateGradients;

    // Initial check
    updateGradients();

    const handleScroll = () => updateGradientsRef.current?.();

    // Update on scroll
    container.addEventListener("scroll", handleScroll);

    // Update on resize (in case content changes)
    const resizeObserver = new ResizeObserver(() =>
      updateGradientsRef.current?.(),
    );
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, []); // Only run once on mount

  // Trigger gradient updates when content changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to re-run when history loads or suggestions change
  useEffect(() => {
    updateGradientsRef.current?.();
  }, [isHistoryLoaded, displayedSuggestions.length]);

  function handleClick(domain: string) {
    captureClient("search_suggestion_clicked", {
      domain,
      source: "suggestion",
    });
    if (onSuggestionClickAction) {
      onSuggestionClickAction(domain);
      return;
    }
    router.push(`/${encodeURIComponent(domain)}`);
  }

  function handleClearHistory() {
    clearHistory();
    captureClient("search_history_cleared", {
      source: "suggestion",
    });

    // Scroll back to the left with smooth animation
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: 0,
        behavior: "smooth",
      });
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
                  "flex-shrink-0 cursor-pointer bg-muted/15 ring-1 ring-border/60 hover:bg-muted/50 dark:bg-muted/70 dark:hover:bg-muted/90",
                  "first-of-type:ml-[1px]",
                  isHistoryLoaded ? "visible" : "invisible",
                )}
                onClick={() => handleClick(domain)}
              >
                <span className="inline-flex items-center gap-2">
                  <Favicon
                    domain={domain}
                    size={faviconSize}
                    className="rounded"
                  />
                  {domain}
                </span>
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
      {showLeftGradient && (
        <div className="pointer-events-none absolute top-0 left-0 h-full w-12 bg-gradient-to-r from-background to-transparent" />
      )}
      {/* Right gradient - shown when more content available */}
      {showRightGradient && (
        <div className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-background to-transparent" />
      )}
    </div>
  );
}
