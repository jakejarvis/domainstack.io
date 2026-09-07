"use client";

import { differenceInDays, formatDistanceStrict } from "date-fns";
import { useMemo } from "react";

import { RelativeTimeSuffix } from "@/components/domain/relative-time-suffix";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { cn } from "@domainstack/ui/utils";
import { toDateTimeAttr } from "@domainstack/utils/date";

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
  const dateTime = toDateTimeAttr(to);

  const state = useMemo(() => {
    if (!now || !dateTime) return null;
    const targetDate = new Date(dateTime);
    return {
      text: formatDistanceStrict(targetDate, now, { addSuffix: true }),
      daysUntil: differenceInDays(targetDate, now),
    };
  }, [dateTime, now]);

  return (
    <RelativeTimeSuffix
      dateTime={dateTime}
      text={state?.text ?? null}
      className={cn(
        state && state.daysUntil <= dangerDays && "text-red-600 dark:text-red-400",
        state &&
          state.daysUntil > dangerDays &&
          state.daysUntil <= warnDays &&
          "text-amber-600 dark:text-amber-400",
        className,
      )}
    />
  );
}
