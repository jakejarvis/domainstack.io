import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable } from "react-native";

import { cn } from "@/lib/cn";
import { useCSSVariable } from "@/tw";

import { Text } from "./text";

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
      ? "bg-control-primary"
      : variant === "danger"
        ? "bg-danger"
        : variant === "secondary"
          ? "border border-line bg-control-secondary"
          : "bg-transparent";
  const textClassName =
    variant === "primary"
      ? "text-control-primary-text"
      : variant === "danger"
        ? "text-danger-text"
        : variant === "ghost"
          ? "text-brand"
          : "text-control-secondary-text";

  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        "min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4",
        variantClassName,
        isDisabled && "opacity-55",
        className,
      )}
      disabled={isDisabled}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.selectionAsync();
        }
        onPress?.();
      }}
      style={({ pressed }) => ({
        opacity: pressed && !isDisabled ? 0.82 : 1,
      })}
    >
      {loading && <ActivityIndicator color={foregroundColor} size="small" />}
      <Text className={cn("text-center text-base font-semibold", textClassName)}>{children}</Text>
    </Pressable>
  );
}
