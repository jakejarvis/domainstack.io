"use client";

import { cn } from "@domainstack/ui/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { useEffect, useState } from "react";

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
