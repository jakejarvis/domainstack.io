"use client";

import { formatDistanceStrict } from "date-fns";
import { useMemo } from "react";

import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { cn } from "@domainstack/ui/utils";

export function RelativeAgeString({
  from,
  className,
}: {
  /** Date value */
  from: number | string | Date;
  /** className applied to the wrapper span */
  className?: string;
}) {
  // Use shared hydrated time so the server and client render the same string
  const now = useHydratedNow();

  const text = useMemo(() => {
    if (!now) return null;
    try {
      return formatDistanceStrict(new Date(from), now, { addSuffix: true });
    } catch {
      // Invalid date
      return null;
    }
  }, [from, now]);

  // Render invisible placeholder before hydration to prevent layout shift
  if (!text) {
    return (
      <span className={cn("invisible", className)} aria-hidden>
        (loading)
      </span>
    );
  }

  return <span className={cn(className)}>({text})</span>;
}
