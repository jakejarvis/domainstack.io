import SegmentedControlNative from "@expo/ui/community/segmented-control";
import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { useColorScheme, View } from "react-native";
import { useCSSVariable } from "uniwind";

export function SegmentedControl<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  const tintColor = useCSSVariable("--color-brand") as string;
  const appearance = useColorScheme() === "dark" ? "dark" : "light";
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const values = useMemo(() => options.map((option) => option.label), [options]);

  return (
    <View>
      <SegmentedControlNative
        appearance={appearance}
        onChange={(event) => {
          const option = options[event.nativeEvent.selectedSegmentIndex];
          if (option) {
            if (process.env.EXPO_OS !== "web") void Haptics.selectionAsync();
            onChange(option.value);
          }
        }}
        selectedIndex={selectedIndex}
        tintColor={tintColor}
        values={values}
      />
    </View>
  );
}
