"use client";

import { useLingui } from "@lingui/react/macro";
import { useMemo } from "react";

import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { cn } from "@domainstack/ui/utils";
import { getRelativeExpiry } from "@domainstack/utils";

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
  const { i18n } = useLingui();

  const state = useMemo(() => {
    if (!now) return null;
    return getRelativeExpiry(to, { now, dangerDays, warnDays, locale: i18n.locale });
  }, [to, now, dangerDays, warnDays, i18n.locale]);

  // SSR: render nothing until client hydrates
  if (!state) return null;

  const { text, tone } = state;

  return (
    <span
      className={cn(
        tone === "danger" && "text-red-600 dark:text-red-400",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      ({text})
    </span>
  );
}
