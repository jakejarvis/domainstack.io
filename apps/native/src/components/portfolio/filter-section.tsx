import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Symbol } from "@/components/symbol";
import { Text } from "@/components/text";

export function FilterSection({
  children,
  defaultExpanded = true,
  summary,
  title,
}: {
  children: React.ReactNode;
  defaultExpanded?: boolean;
  summary?: string;
  title: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const handleToggle = useCallback(() => setExpanded((value) => !value), []);
  const chevronColor = useCSSVariable("--color-muted-foreground") as string;

  return (
    <View className="border-b border-border">
      <Pressable accessibilityRole="button" hitSlop={4} onPress={handleToggle}>
        <View className="flex-row items-center justify-between py-3">
          <Text className="text-base font-semibold">{title}</Text>
          <View className="flex-row items-center gap-2">
            {summary ? <Text className="text-sm text-muted-foreground">{summary}</Text> : null}
            <Symbol
              color={chevronColor}
              name={expanded ? "chevron.down" : "chevron.right"}
              size={14}
            />
          </View>
        </View>
      </Pressable>
      {expanded ? <View className="gap-1 pb-3">{children}</View> : null}
    </View>
  );
}

export function FilterOptionRow({
  label,
  onPress,
  selected,
  variant = "checkbox",
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  variant?: "checkbox" | "radio";
}) {
  const accent = useCSSVariable("--color-brand") as string;
  const muted = useCSSVariable("--color-muted-foreground") as string;
  const symbolName = selected
    ? variant === "radio"
      ? "largecircle.fill.circle"
      : "checkmark.circle.fill"
    : "circle";

  return (
    <Pressable
      accessibilityRole={variant === "radio" ? "radio" : "checkbox"}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-3 py-2">
        <Symbol color={selected ? accent : muted} name={symbolName} size={22} />
        <Text className="flex-1 text-base">{label}</Text>
      </View>
    </Pressable>
  );
}
