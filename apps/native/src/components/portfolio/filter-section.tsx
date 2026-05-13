import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { MutedText, Text } from "@/components/text";
import { cn } from "@/lib/cn";

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

  return (
    <View className="border-line border-b">
      <Pressable accessibilityRole="button" hitSlop={4} onPress={handleToggle}>
        <View className="flex-row items-center justify-between py-3">
          <Text className="text-base font-semibold">{title}</Text>
          <View className="flex-row items-center gap-2">
            {summary ? <MutedText>{summary}</MutedText> : null}
            <Text className="text-text-secondary text-base">{expanded ? "▾" : "▸"}</Text>
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
  const indicatorClass = variant === "radio" ? "rounded-full" : "rounded";

  return (
    <Pressable
      accessibilityRole={variant === "radio" ? "radio" : "checkbox"}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-3 py-2">
        <View
          className={cn(
            "h-5 w-5 items-center justify-center border-2",
            indicatorClass,
            selected ? "border-brand bg-brand" : "border-line",
          )}
        >
          {selected ? (
            <Text className="text-control-primary-text text-xs leading-none font-bold">
              {variant === "radio" ? "●" : "✓"}
            </Text>
          ) : null}
        </View>
        <Text className="flex-1 text-base">{label}</Text>
      </View>
    </Pressable>
  );
}
