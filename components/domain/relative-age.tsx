"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function RelativeAgeString({
  from,
  className,
}: {
  /** Date value */
  from: number | string | Date;
  /** className applied to the wrapper span */
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null);

  // format distance to now
  useEffect(() => {
    try {
      const rel = formatDistanceToNowStrict(new Date(from), {
        addSuffix: true,
      });
      setText(rel);
    } catch {}
  }, [from]);

  // make SSR happy
  if (!text) return null;

  return <span className={cn(className)}>({text})</span>;
}
