import { View } from "react-native";

import { cn } from "@/lib/cn";

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneStyles = {
    danger: "border-danger bg-danger-soft text-danger",
    neutral: "border-line bg-control-secondary text-text-secondary",
    success: "border-success bg-success-soft text-success",
    warning: "border-warning bg-warning-soft text-warning",
  } satisfies Record<typeof tone, string>;

  return (
    <View
      className={cn(
        "flex-row items-center gap-1 self-start rounded-full border px-2.5 py-1",
        "text-xs font-semibold",
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </View>
  );
}
