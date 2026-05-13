import { View } from "react-native";

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count }, (_, index) => (
        <View className="border-line bg-glass h-24 rounded-2xl border" key={index} />
      ))}
    </View>
  );
}
