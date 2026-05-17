import { ActivityIndicator } from "react-native";
import { useCSSVariable } from "uniwind";

export function Spinner({
  size = "small",
  variant = "default",
}: {
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
  return <ActivityIndicator color={color} size={size} />;
}
