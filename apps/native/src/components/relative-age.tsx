import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@domainstack/utils";

import { Text } from "./text";

export function RelativeAge({
  from,
  className,
}: {
  from: number | string | Date;
  className?: string;
}) {
  const text = useMemo(() => formatRelativeTime(from), [from]);
  if (!text) return null;
  return <Text className={cn("tabular-nums", className)}>({text})</Text>;
}
