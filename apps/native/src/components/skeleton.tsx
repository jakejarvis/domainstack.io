import { View } from "react-native";

export function SkeletonRows({ count = 3 }: { count?: number }) {
  const rows = Array.from({ length: count }, (_, index) => `skeleton-row-${count}-${index}`);

  return (
    <View className="gap-3">
      {rows.map((key) => (
        <View className="border-line bg-glass h-24 rounded-2xl border" key={key} />
      ))}
    </View>
  );
}
