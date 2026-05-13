import { BlurView } from "expo-blur";
import { useColorScheme } from "react-native";
import { View } from "react-native";

import { cn } from "@/lib/cn";

export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isDark = useColorScheme() === "dark";

  return (
    <BlurView
      className={cn("overflow-hidden rounded-2xl", className)}
      intensity={isDark ? 26 : 18}
      tint={isDark ? "dark" : "light"}
    >
      <View className="border-line bg-glass gap-4 border p-4">{children}</View>
    </BlurView>
  );
}
