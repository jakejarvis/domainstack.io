import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Symbol } from "@/components/symbol";
import { Text } from "@/components/text";
import { cn } from "@/lib/cn";

export function GroupedSection({
  children,
  footer,
  title,
}: {
  children?: ReactNode;
  footer?: string;
  title?: string;
}) {
  return (
    <View className="gap-1.5">
      {title ? (
        <Text className="ml-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </Text>
      ) : null}
      {children ? (
        <View
          className="bg-glass overflow-hidden rounded-2xl border border-border"
          style={{ borderCurve: "continuous" }}
        >
          {children}
        </View>
      ) : null}
      {footer ? <Text className="ml-4 text-xs text-muted-foreground">{footer}</Text> : null}
    </View>
  );
}

export function GroupedRow({
  children,
  disabled,
  onPress,
  showChevron,
  trailing,
}: {
  children: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  showChevron?: boolean;
  trailing?: ReactNode;
}) {
  const muted = useCSSVariable("--color-muted-foreground") as string;
  const hasTrailing = trailing !== undefined || showChevron;

  const content = (
    <View
      className={cn(
        "min-h-12 flex-row items-center gap-3 border-b border-border px-4 py-3 last:border-b-0",
        disabled && "opacity-55",
      )}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-3">{children}</View>
      {trailing}
      {showChevron ? <Symbol color={muted} name="chevron.right" size={14} /> : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable accessibilityRole={hasTrailing ? "button" : "link"} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return content;
}
