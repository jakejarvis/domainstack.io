import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable } from "react-native";
import { useCSSVariable } from "uniwind";

import { cn, cva, type VariantProps } from "@/lib/cn";

import { TextClassContext } from "./text";

const buttonVariants = cva({
  base: "min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4",
  variants: {
    variant: {
      primary: "bg-primary",
      secondary: "border border-border bg-secondary",
      danger: "bg-destructive",
      ghost: "bg-transparent",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

const buttonLabelVariants = cva({
  base: "text-base font-semibold",
  variants: {
    variant: {
      primary: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      danger: "text-destructive-foreground",
      ghost: "text-brand",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

type Variant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

// CSS-variable names (not classes) so the spinner can match the label color.
const labelColorVariable = {
  primary: "--color-primary-foreground",
  secondary: "--color-secondary-foreground",
  danger: "--color-destructive-foreground",
  ghost: "--color-brand",
} satisfies Record<Variant, string>;

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
  variant?: Variant;
}) {
  const isDisabled = Boolean(disabled || loading);
  const foregroundColor = useCSSVariable(labelColorVariable[variant]) as string;
  const labelClassName = buttonLabelVariants({ variant });

  return (
    <Pressable
      accessibilityRole="button"
      className={cn(buttonVariants({ variant }), isDisabled && "opacity-55", className)}
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
      <TextClassContext.Provider value={labelClassName}>
        {loading ? <ActivityIndicator color={foregroundColor} size="small" /> : null}
        {children}
      </TextClassContext.Provider>
    </Pressable>
  );
}
