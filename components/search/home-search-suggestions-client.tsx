"use client";

import { XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { Favicon } from "@/components/icons/favicon";
import { useHomeSearch } from "@/components/search/home-search-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export type HomeSearchSuggestionsClientProps = {
  defaultSuggestions: string[];
  className?: string;
  faviconSize?: number;
  max?: number;
};

export function HomeSearchSuggestionsClient({
  defaultSuggestions,
  className,
  faviconSize = 16,
  max = MAX_HISTORY_ITEMS,
}: HomeSearchSuggestionsClientProps) {
  const router = useRouter();
  const analytics = useAnalytics();
  const { onSuggestionClick } = useHomeSearch();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { history, isHistoryLoaded, clearHistory } = useDomainHistory();

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
    if (
      scrollContainerRef.current &&
      typeof scrollContainerRef.current.scrollTo === "function"
    ) {
      scrollContainerRef.current.scrollTo({
        left: 0,
        behavior: "smooth",
      });
    }
  }

  return (
    <ScrollArea
      className={cn("w-full", className)}
      orientation="horizontal"
      gradient
      showScrollbar={false}
      viewportRef={scrollContainerRef}
    >
      <div className="flex gap-2 px-[1px] py-[2px]">
        {(isHistoryLoaded ? displayedSuggestions : defaultSuggestions).map(
          (domain) => (
            <Button
              key={domain}
              variant="secondary"
              size="sm"
              className={cn(
                "shrink-0 gap-2 bg-muted/15 px-2.5 leading-none ring-1 ring-border/60 hover:bg-muted/50 dark:bg-muted/70 dark:hover:bg-muted/90",
                isHistoryLoaded ? "visible" : "invisible",
              )}
              onClick={(e) => {
                e.preventDefault();
                handleClick(domain);
              }}
              nativeButton={false}
              render={
                <Link href={`/${encodeURIComponent(domain)}`} prefetch={false}>
                  <Favicon
                    domain={domain}
                    size={faviconSize}
                    className="pointer-events-none size-4 shrink-0 rounded-sm"
                  />
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
                  className="flex-shrink-0"
                  aria-label="Clear history"
                >
                  <XIcon />
                  <span className="sr-only">Clear history</span>
                </Button>
              }
            />
            <TooltipContent>Clear history</TooltipContent>
          </Tooltip>
        ) : (
          <div className="-ml-2 w-[1px] flex-shrink-0" />
        )}
      </div>
    </ScrollArea>
  );
}
