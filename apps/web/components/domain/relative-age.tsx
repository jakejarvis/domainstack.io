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
  const now = useHydratedNow();

  const text = useMemo(() => {
    if (!now) return null;
    try {
      return formatDistanceStrict(new Date(from), now, { addSuffix: true });
    } catch {
      return null;
    }
  }, [from, now]);

  return (
    <span
      className={cn(!text && "invisible", className)}
      aria-hidden={!text || undefined}
      suppressHydrationWarning
    >
      ({text ?? "loading"})
    </span>
  );
}
