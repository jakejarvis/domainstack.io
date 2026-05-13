import SegmentedControlNative from "@expo/ui/community/segmented-control";
import { useColorScheme, View } from "react-native";

import { useCSSVariable } from "@/tw";

export function SegmentedControl<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  const tintColor = useCSSVariable("--color-brand");
  const appearance = useColorScheme() === "dark" ? "dark" : "light";
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <View>
      <SegmentedControlNative
        appearance={appearance}
        onChange={(event) => {
          const option = options[event.nativeEvent.selectedSegmentIndex];
          if (option) onChange(option.value);
        }}
        selectedIndex={selectedIndex}
        tintColor={tintColor}
        values={options.map((option) => option.label)}
      />
    </View>
  );
}
