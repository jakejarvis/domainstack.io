"use client";

import { XIcon } from "@phosphor-icons/react/ssr";
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
  max = MAX_HISTORY_ITEMS,
}: HomeSearchSuggestionsClientProps) {
  const router = useRouter();
  const analytics = useAnalytics();
  const { onSuggestionClick } = useHomeSearch();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { history, isHistoryLoaded, clearHistory } = useDomainHistory();

  const displayedSuggestions = useMemo(() => {
    const historySet = new Set(history);
    const merged = [
      ...history,
      ...defaultSuggestions.filter((d) => !historySet.has(d)),
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
                  <XIcon />
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
