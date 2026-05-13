import { View } from "react-native";

import { cn } from "@/lib/cn";

import { GlassCard } from "./glass-card";

export function ReportSectionSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <GlassCard className={className}>
      <View className="bg-control-secondary h-4 w-32 rounded" />
      <View className="gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <View
            className={cn("bg-control-secondary h-4 rounded", index % 2 === 0 ? "w-3/4" : "w-2/3")}
            key={index}
          />
        ))}
      </View>
    </GlassCard>
  );
}
