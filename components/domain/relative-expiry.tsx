"use client";

import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ExpiryState = {
  text: string;
  daysUntil: number;
} | null;

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
  const [state, setState] = useState<ExpiryState>(null);

  // Calculate both text and days in a single effect to avoid multiple state updates
  useEffect(() => {
    try {
      const targetDate = new Date(to);
      const now = new Date();
      setState({
        text: formatDistanceToNowStrict(targetDate, { addSuffix: true }),
        daysUntil: differenceInDays(targetDate, now),
      });
    } catch {
      // Invalid date - leave as null
    }
  }, [to]);

  // SSR: render nothing until client calculates values
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
