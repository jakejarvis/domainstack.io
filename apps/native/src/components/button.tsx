import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable } from "react-native";

import { cn } from "@/lib/cn";
import { useCSSVariable } from "@/tw";

export function Button({
  children,
  className,
  disabled,
  loading,
  onPress,
  variant = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const isDisabled = Boolean(disabled || loading);
  const foregroundColor = useCSSVariable(
    variant === "primary"
      ? "--color-control-primary-text"
      : variant === "danger"
        ? "--color-danger-text"
        : variant === "ghost"
          ? "--color-brand"
          : "--color-control-secondary-text",
  );
  const variantClassName =
    variant === "primary"
      ? "bg-control-primary text-control-primary-text"
      : variant === "danger"
        ? "bg-danger text-danger-text"
        : variant === "secondary"
          ? "border border-line bg-control-secondary text-control-secondary-text"
          : "bg-transparent text-brand";

  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        "min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4",
        "text-base font-semibold",
        variantClassName,
        isDisabled && "opacity-55",
        className,
      )}
      disabled={isDisabled}
      onPress={() => {
        if (process.env.EXPO_OS !== "web") {
          void Haptics.selectionAsync();
        }
        onPress?.();
      }}
      style={({ pressed }) => ({
        borderCurve: "continuous",
        transform: [{ scale: pressed && !isDisabled ? 0.96 : 1 }],
      })}
    >
      {loading ? <ActivityIndicator color={foregroundColor} size="small" /> : null}
      {children}
    </Pressable>
  );
}
