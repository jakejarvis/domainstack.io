"use client";

import { useEffect, useMemo, useState } from "react";
import { Favicon } from "@/components/favicon";
import { useHomeSearch } from "@/components/home-search-context";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/hooks/use-router";
import { captureClient } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

export function DomainSuggestionsClient({
  defaultSuggestions,
  className,
  faviconSize = 16,
  max = 5,
}: {
  defaultSuggestions: string[];
  className?: string;
  faviconSize?: number;
  max?: number;
}) {
  const router = useRouter();
  const { onSuggestionClickAction } = useHomeSearch();

  const [history, setHistory] = useState<string[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("search-history");
      if (stored) setHistory(JSON.parse(stored));
    } catch {
      // ignore parse errors
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  const displayedSuggestions = useMemo(() => {
    const merged = [
      ...history,
      ...defaultSuggestions.filter((d) => !history.includes(d)),
    ];
    return merged.slice(0, max);
  }, [history, defaultSuggestions, max]);

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

  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {(historyLoaded ? displayedSuggestions : defaultSuggestions).map(
        (domain) => (
          <Button
            key={domain}
            variant="secondary"
            size="sm"
            className={cn(
              "cursor-pointer bg-muted/15 ring-1 ring-border/60 hover:bg-muted/50 dark:bg-muted/70 dark:hover:bg-muted/90",
              historyLoaded ? "visible" : "invisible",
            )}
            onClick={() => handleClick(domain)}
          >
            <span className="inline-flex items-center gap-2">
              <Favicon domain={domain} size={faviconSize} className="rounded" />
              {domain}
            </span>
          </Button>
        ),
      )}
    </div>
  );
}
