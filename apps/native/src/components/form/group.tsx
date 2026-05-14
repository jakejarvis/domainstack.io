import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Symbol } from "@/components/symbol";
import { MutedText } from "@/components/text";
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
        <MutedText className="ml-4 text-xs font-semibold tracking-wider uppercase">
          {title}
        </MutedText>
      ) : null}
      {children ? (
        <View
          className="border-line bg-glass overflow-hidden rounded-2xl border"
          style={{ borderCurve: "continuous" }}
        >
          {children}
        </View>
      ) : null}
      {footer ? <MutedText className="ml-4 text-xs">{footer}</MutedText> : null}
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
  const muted = useCSSVariable("--color-text-secondary") as string;
  const hasTrailing = trailing !== undefined || showChevron;

  const content = (
    <View
      className={cn(
        "border-line min-h-12 flex-row items-center gap-3 border-b px-4 py-3 last:border-b-0",
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
