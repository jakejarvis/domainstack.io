import { useLingui } from "@lingui/react/macro";
import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { getRelativeExpiry, type RelativeExpiryTone } from "@domainstack/utils";

import { Text } from "./text";

const toneClass: Record<RelativeExpiryTone, string> = {
  danger: "text-destructive",
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
  const { i18n } = useLingui();
  const state = useMemo(
    () => getRelativeExpiry(to, { dangerDays, warnDays, locale: i18n.locale }),
    [to, dangerDays, warnDays, i18n.locale],
  );

  if (!state) return null;

  return (
    <Text className={cn("tabular-nums", toneClass[state.tone], className)}>({state.text})</Text>
  );
}
