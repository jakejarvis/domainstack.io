import { Pressable, View } from "react-native";

import { cn } from "@/lib/cn";

import { Text } from "./text";

export function SegmentedControl<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <View className="border-line bg-glass flex-row rounded-xl border p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={cn(
              "min-h-10 flex-1 items-center justify-center rounded-lg px-2",
              selected && "bg-brand-strong",
            )}
            key={option.value}
            onPress={() => onChange(option.value)}
          >
            <Text
              className={cn(
                "text-center text-sm font-semibold",
                selected ? "text-text-primary" : "text-text-secondary",
              )}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
