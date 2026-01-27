"use client";

import { cn } from "@domainstack/ui/utils";
import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import { useMemo } from "react";
import { useHydratedNow } from "@/hooks/use-hydrated-now";

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
  // Use shared hydrated time to avoid render cascades
  const now = useHydratedNow();

  // Calculate state synchronously using memoization
  const state = useMemo(() => {
    if (!now) return null;
    try {
      const targetDate = new Date(to);
      return {
        text: formatDistanceToNowStrict(targetDate, { addSuffix: true }),
        daysUntil: differenceInDays(targetDate, now),
      };
    } catch {
      // Invalid date
      return null;
    }
  }, [to, now]);

  // SSR: render nothing until client hydrates
  if (!state) return null;

  const { text, daysUntil } = state;

  return (
    <span
      className={cn(
        daysUntil <= dangerDays && "text-red-600 dark:text-red-400",
        daysUntil > dangerDays &&
          daysUntil <= warnDays &&
          "text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      ({text})
    </span>
  );
}
