"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
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

  // Avoid chaotic "items flying" when switching between default suggestions and
  // history-blended suggestions by crossfading the whole list between modes.
  const suggestionsMode = isHistoryLoaded
    ? history.length > 0
      ? "history"
      : "default"
    : "loading";

  const isPlaceholder = suggestionsMode === "loading";

  const suggestionsForRender =
    suggestionsMode === "history" ? displayedSuggestions : defaultSuggestions;

  // Set up scroll and resize observers once on mount
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const updateGradients = () => {
      // Cancel any pending frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Schedule update for next frame to throttle and prevent layout thrashing
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const { scrollLeft, scrollWidth, clientWidth } = container;

        const shouldShowLeft = scrollLeft > 0;
        const shouldShowRight = scrollLeft < scrollWidth - clientWidth - 1;

        // Only update state if values actually changed to prevent render loops
        setShowLeftGradient((prev) =>
          prev === shouldShowLeft ? prev : shouldShowLeft,
        );
        setShowRightGradient((prev) =>
          prev === shouldShowRight ? prev : shouldShowRight,
        );
      });
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
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, []); // Only run once on mount

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
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollContainerRef}
        className="scrollbar-hide overflow-x-auto py-0.5"
      >
        <div className="flex gap-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={suggestionsMode}
              className="flex gap-2"
              aria-hidden={isPlaceholder}
              style={isPlaceholder ? { visibility: "hidden" } : undefined}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{
                duration: 0.18,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
            >
              {suggestionsForRender.map((domain, index) => (
                <motion.div
                  key={domain}
                  initial={{ opacity: 0, y: 4, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{
                    duration: 0.18,
                    ease: [0.22, 1, 0.36, 1] as const,
                    delay:
                      suggestionsMode === "loading"
                        ? 0
                        : Math.min(index * 0.015, 0.12),
                  }}
                  className="first-of-type:ml-[1px]"
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 bg-muted/15 px-2.5 ring-1 ring-border/60 hover:bg-muted/50 dark:bg-muted/70 dark:hover:bg-muted/90"
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
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
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
      <AnimatePresence initial={false}>
        {showLeftGradient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.18,
              ease: [0.22, 1, 0.36, 1] as const,
            }}
            className="pointer-events-none absolute top-0 left-0 h-full w-12 bg-gradient-to-r from-background to-transparent"
          />
        )}
      </AnimatePresence>
      {/* Right gradient - shown when more content available */}
      <AnimatePresence initial={false}>
        {showRightGradient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.18,
              ease: [0.22, 1, 0.36, 1] as const,
            }}
            className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-background to-transparent"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
