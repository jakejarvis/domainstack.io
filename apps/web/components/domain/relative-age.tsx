"use client";

import { useLingui } from "@lingui/react/macro";
import { useMemo } from "react";

import { cn } from "@domainstack/ui/utils";
import { formatRelativeTime } from "@domainstack/utils";

export function RelativeAgeString({
  from,
  className,
}: {
  /** Date value */
  from: number | string | Date;
  /** className applied to the wrapper span */
  className?: string;
}) {
  const { i18n } = useLingui();
  const text = useMemo(() => formatRelativeTime(from, i18n.locale), [from, i18n.locale]);

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
