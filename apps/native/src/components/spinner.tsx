import { ActivityIndicator } from "react-native";

import { useCSSVariable } from "@/tw";

export function Spinner({
  size = "small",
  tone = "default",
}: {
  size?: "small" | "large";
  tone?: "default" | "muted" | "brand";
}) {
  const variable =
    tone === "brand"
      ? "--color-brand"
      : tone === "muted"
        ? "--color-text-secondary"
        : "--color-text-primary";
  const color = useCSSVariable(variable);
  return <ActivityIndicator color={color} size={size} />;
}
