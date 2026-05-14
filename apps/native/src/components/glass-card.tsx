import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useColorScheme, View } from "react-native";

import { cn } from "@/lib/cn";

const liquidGlass = isLiquidGlassAvailable();

export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isDark = useColorScheme() === "dark";

  if (liquidGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        style={{ borderCurve: "continuous", borderRadius: 16, overflow: "hidden" }}
      >
        <View className={cn("border-line gap-4 border p-4", className)}>{children}</View>
      </GlassView>
    );
  }

  return (
    <BlurView
      className={cn("overflow-hidden rounded-2xl", className)}
      intensity={isDark ? 26 : 18}
      style={{ borderCurve: "continuous" }}
      tint={isDark ? "dark" : "light"}
    >
      <View className="border-line bg-glass gap-4 border p-4">{children}</View>
    </BlurView>
  );
}
