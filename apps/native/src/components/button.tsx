import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable } from "react-native";

import { cn } from "@/lib/cn";

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

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      className={cn(
        "min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4",
        variant === "primary" && "bg-brand-strong",
        variant === "secondary" && "border-line bg-glass border",
        variant === "danger" && "bg-danger",
        variant === "ghost" && "bg-transparent",
        isDisabled && "opacity-55",
        className,
      )}
    >
      {loading && <ActivityIndicator color="#f6faf7" size="small" />}
      <Text
        className={cn(
          "text-center text-base font-semibold",
          variant === "ghost" && "text-brand",
          variant !== "ghost" && "text-text-primary",
        )}
      >
        {children}
      </Text>
    </Pressable>
  );
}
