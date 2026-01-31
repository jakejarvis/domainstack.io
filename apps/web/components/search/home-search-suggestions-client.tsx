"use client";

import { useAnalytics } from "@domainstack/analytics/client";
import { MAX_HISTORY_ITEMS } from "@domainstack/constants";
import { Button } from "@domainstack/ui/button";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@domainstack/ui/tooltip";
import { cn } from "@domainstack/ui/utils";
import { IconX } from "@tabler/icons-react";
import { useSetAtom } from "jotai";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Favicon } from "@/components/icons/favicon";
import { pendingDomainAtom } from "@/lib/atoms/search-atoms";
import { useSearchHistoryStore } from "@/lib/stores/search-history-store";

export type HomeSearchSuggestionsClientProps = {
  defaultSuggestions: string[];
  className?: string;
  faviconSize?: number;
  max?: number;
};

export function HomeSearchSuggestionsClient({
  defaultSuggestions,
  className,
  max = MAX_HISTORY_ITEMS,
}: HomeSearchSuggestionsClientProps) {
  const analytics = useAnalytics();
  const setPendingDomain = useSetAtom(pendingDomainAtom);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track hydration state for consistent rendering
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  useEffect(() => {
    setIsHistoryLoaded(true);
  }, []);

  const history = useSearchHistoryStore((s) => s.history);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  const displayedSuggestions = useMemo(() => {
    const historySet = new Set(history);
    const merged = [
      ...history,
      ...defaultSuggestions.filter((d) => !historySet.has(d)),
    ];
    return merged.slice(0, max);
  }, [history, defaultSuggestions, max]);

  const handleClick = useCallback(
    (domain: string) => {
      analytics.track("search_suggestion_clicked", {
        domain,
        source: "suggestion",
      });
      // Set pending domain for SearchClient to pick up and navigate
      setPendingDomain(domain);
    },
    [analytics, setPendingDomain],
  );

  const handleClearHistory = useCallback(() => {
    clearHistory();
    analytics.track("search_history_cleared");

    // Scroll back to the left with smooth animation
    if (
      scrollContainerRef.current &&
      typeof scrollContainerRef.current.scrollTo === "function"
    ) {
      scrollContainerRef.current.scrollTo({
        left: 0,
        behavior: "smooth",
      });
    }
  }, [analytics, clearHistory]);

  return (
    <ScrollArea
      className={cn("w-full", className)}
      scrollRef={scrollContainerRef}
      hideScrollbar
    >
      <div className="flex gap-2 p-0.5">
        {(isHistoryLoaded ? displayedSuggestions : defaultSuggestions).map(
          (domain) => (
            <Button
              key={domain}
              variant="secondary"
              size="sm"
              className={cn(
                "shrink-0 gap-2 border-none bg-muted/40 px-2.5 leading-none ring-1 ring-ring/20 hover:bg-muted/60",
                isHistoryLoaded ? "visible" : "invisible",
              )}
              onClick={(e) => {
                e.preventDefault();
                handleClick(domain);
              }}
              nativeButton={false}
              render={
                <Link href={`/${encodeURIComponent(domain)}`} prefetch={false}>
                  <Favicon domain={domain} className="shrink-0" />
                  {domain}
                </Link>
              }
            />
          ),
        )}
        {isHistoryLoaded && history.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleClearHistory}
                  className="shrink-0"
                  aria-label="Clear history"
                >
                  <IconX />
                  <span className="sr-only">Clear history</span>
                </Button>
              }
            />
            <TooltipContent>Clear history</TooltipContent>
          </Tooltip>
        ) : (
          <div className="-ml-2 w-[1px] shrink-0" />
        )}
      </div>
    </ScrollArea>
  );
}
