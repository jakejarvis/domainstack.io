import { ActivityIndicator } from "react-native";
import { useCSSVariable } from "uniwind";

export function Spinner({
  accessibilityLabel = "Loading",
  size = "small",
  variant = "default",
}: {
  accessibilityLabel?: string;
  size?: "small" | "large";
  variant?: "default" | "muted" | "brand";
}) {
  const variable =
    variant === "brand"
      ? "--color-brand"
      : variant === "muted"
        ? "--color-muted-foreground"
        : "--color-foreground";
  const color = useCSSVariable(variable) as string;
  return (
    <ActivityIndicator
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      color={color}
      size={size}
    />
  );
}
