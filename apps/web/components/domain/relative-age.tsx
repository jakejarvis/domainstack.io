"use client";

import { formatDistanceStrict } from "date-fns";
import { useMemo } from "react";

import { RelativeTimeSuffix } from "@/components/domain/relative-time-suffix";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { toDateTimeAttr } from "@domainstack/utils/date";

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
  const dateTime = toDateTimeAttr(from);

  const text = useMemo(() => {
    if (!now || !dateTime) return null;
    return formatDistanceStrict(new Date(dateTime), now, { addSuffix: true });
  }, [dateTime, now]);

  return <RelativeTimeSuffix dateTime={dateTime} text={text} className={className} />;
}
