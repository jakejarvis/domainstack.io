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
      return null;
    }
  }, [to, now]);

  return (
    <span
      className={cn(
        !state && "invisible",
        state && state.daysUntil <= dangerDays && "text-red-600 dark:text-red-400",
        state &&
          state.daysUntil > dangerDays &&
          state.daysUntil <= warnDays &&
          "text-amber-600 dark:text-amber-400",
        className,
      )}
      aria-hidden={!state || undefined}
      suppressHydrationWarning
    >
      ({state?.text ?? "loading"})
    </span>
  );
}
