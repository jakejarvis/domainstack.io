import { View } from "react-native";

import { cn } from "@/lib/cn";

import { GlassCard } from "./glass-card";
import { Text } from "./text";

export function ReportSection({
  title,
  trailing,
  children,
  className,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={className}>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-base font-semibold tracking-wide uppercase">{title}</Text>
        {trailing}
      </View>
      <View className={cn("gap-3")}>{children}</View>
    </GlassCard>
  );
}
