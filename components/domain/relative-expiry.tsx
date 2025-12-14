"use client";

import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function RelativeExpiryString({
  to,
  dangerDays,
  warnDays,
  className,
}: {
  /** Date value */
  to: number | string | Date;
  /** days threshold for red (imminent) */
  dangerDays?: number;
  /** days threshold for yellow (soon) */
  warnDays?: number;
  /** className applied to the wrapper span */
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [daysUntil, setDaysUntil] = useState<number | null>(null);

  // format distance to now (runs on client after mount)
  useEffect(() => {
    try {
      const rel = formatDistanceToNowStrict(new Date(to), { addSuffix: true });
      setText(rel);
    } catch {}
  }, [to]);

  // calculate days until expiry (runs on client after mount)
  useEffect(() => {
    try {
      const now = new Date();
      const days = differenceInDays(new Date(to), now);
      setDaysUntil(days);
    } catch {}
  }, [to]);

  // make SSR happy
  if (!text) return null;

  return (
    <span
      className={cn(
        daysUntil !== null &&
          daysUntil <= (dangerDays ?? 0) &&
          "text-red-600 dark:text-red-400",
        daysUntil !== null &&
          daysUntil > (dangerDays ?? 0) &&
          daysUntil <= (warnDays ?? 0) &&
          "text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      ({text})
    </span>
  );
}
