"use client";

import { differenceInDays, formatDistanceStrict } from "date-fns";
import { useMemo } from "react";

import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { cn } from "@domainstack/ui/utils";

export function RelativeExpiryString({
  to,
  dangerDays = 7,
  warnDays = 14,
  className,
}: {
  /** Date value */
  to: number | string | Date;
  /** days threshold for red (imminent), defaults to 7 */
  dangerDays?: number;
  /** days threshold for yellow (soon), defaults to 14 */
  warnDays?: number;
  /** className applied to the wrapper span */
  className?: string;
}) {
  // Use shared hydrated time so the server and client render the same string
  const now = useHydratedNow();

  const state = useMemo(() => {
    if (!now) return null;
    try {
      const targetDate = new Date(to);
      return {
        text: formatDistanceStrict(targetDate, now, { addSuffix: true }),
        daysUntil: differenceInDays(targetDate, now),
      };
    } catch {
      // Invalid date
      return null;
    }
  }, [to, now]);

  // Render invisible placeholder before hydration to prevent layout shift
  if (!state) {
    return (
      <span className={cn("invisible", className)} aria-hidden>
        (loading)
      </span>
    );
  }

  const { text, daysUntil } = state;

  return (
    <span
      className={cn(
        daysUntil <= dangerDays && "text-red-600 dark:text-red-400",
        daysUntil > dangerDays && daysUntil <= warnDays && "text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      ({text})
    </span>
  );
}
