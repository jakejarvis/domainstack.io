"use client";

import { cn } from "@domainstack/ui/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { useMemo } from "react";

export function RelativeAgeString({
  from,
  className,
}: {
  /** Date value */
  from: number | string | Date;
  /** className applied to the wrapper span */
  className?: string;
}) {
  const text = useMemo(() => {
    try {
      return formatDistanceToNowStrict(new Date(from), { addSuffix: true });
    } catch {
      return null;
    }
  }, [from]);

  // Render invisible placeholder during SSR to prevent layout shift
  if (!text) {
    return (
      <span className={cn("invisible", className)} aria-hidden>
        (loading)
      </span>
    );
  }

  return <span className={cn(className)}>({text})</span>;
}
