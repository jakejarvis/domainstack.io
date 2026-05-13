import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { getRelativeExpiry, type RelativeExpiryTone } from "@domainstack/utils";

import { Text } from "./text";

const toneClass: Record<RelativeExpiryTone, string> = {
  danger: "text-danger",
  default: "",
  warn: "text-warning",
};

export function RelativeExpiry({
  to,
  dangerDays = 7,
  warnDays = 14,
  className,
}: {
  to: number | string | Date;
  dangerDays?: number;
  warnDays?: number;
  className?: string;
}) {
  const state = useMemo(
    () => getRelativeExpiry(to, { dangerDays, warnDays }),
    [to, dangerDays, warnDays],
  );

  if (!state) return null;

  return <Text className={cn(toneClass[state.tone], className)}>({state.text})</Text>;
}
