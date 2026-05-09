import { BlurView } from "expo-blur";
import { View } from "react-native";

import { cn } from "@/lib/cn";

export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <BlurView intensity={28} tint="dark" className={cn("overflow-hidden rounded-2xl", className)}>
      <View className="border-line bg-glass gap-4 border p-4">{children}</View>
    </BlurView>
  );
}
