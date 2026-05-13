import { cn } from "@/lib/cn";

import { Text } from "./text";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneStyles = {
    danger: "border-danger bg-danger-soft text-danger",
    neutral: "border-line bg-control-secondary text-text-secondary",
    success: "border-success bg-success-soft text-success",
    warning: "border-warning bg-warning-soft text-warning",
  } satisfies Record<typeof tone, string>;

  return (
    <Text
      className={cn(
        "self-start rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneStyles[tone],
      )}
    >
      {children}
    </Text>
  );
}
