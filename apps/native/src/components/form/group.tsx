import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Symbol } from "@/components/symbol";
import { Text } from "@/components/text";
import { cn } from "@/lib/cn";

/**
 * The single section primitive for the whole app — iOS inset-grouped: a
 * sentence-case grey header *outside* a bordered opaque container, optional
 * grey footer below. `padded` switches the body from edge-to-edge rows
 * (settings-style lists) to a padded container for free-form content (the
 * domain report sections), so report and settings screens read identically.
 */
export function GroupedSection({
  children,
  footer,
  padded = false,
  title,
  trailing,
}: {
  children?: ReactNode;
  footer?: string;
  padded?: boolean;
  title?: string;
  trailing?: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      {title || trailing ? (
        <View className="mr-1 ml-4 min-h-6 flex-row items-center justify-between gap-3">
          {title ? (
            <Text variant="footnote" className="flex-1 text-muted-foreground">
              {title}
            </Text>
          ) : (
            <View className="flex-1" />
          )}
          {trailing}
        </View>
      ) : null}
      {children ? (
        <View
          className="overflow-hidden rounded-2xl border border-border bg-card"
          style={{ borderCurve: "continuous" }}
        >
          {padded ? <View className="gap-3 p-4">{children}</View> : children}
        </View>
      ) : null}
      {footer ? (
        <Text variant="footnote" className="ml-4 text-muted-foreground">
          {footer}
        </Text>
      ) : null}
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
