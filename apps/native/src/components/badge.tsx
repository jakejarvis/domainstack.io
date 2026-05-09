import { cn } from "@/lib/cn";

import { Text } from "./text";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <Text
      className={cn(
        "self-start rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "border-line bg-glass text-text-secondary",
        tone === "success" && "border-brand/40 bg-brand/15 text-brand",
        tone === "warning" && "border-warning/40 bg-warning/15 text-warning",
        tone === "danger" && "border-danger/40 bg-danger/15 text-danger",
      )}
    >
      {children}
    </Text>
  );
}
