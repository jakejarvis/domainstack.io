import { View } from "react-native";

import { Badge } from "@/components/badge";
import { GlassCard } from "@/components/glass-card";
import { MutedText, Text } from "@/components/text";
import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "danger";

function ratioToTone(activeCount: number, planQuota: number): Tone {
  if (planQuota <= 0) return "success";
  const ratio = activeCount / planQuota;
  if (ratio >= 1) return "danger";
  if (ratio >= 0.8) return "warning";
  return "success";
}

export function QuotaMeter({
  activeCount,
  plan,
  planQuota,
}: {
  activeCount: number;
  plan: string;
  planQuota: number;
}) {
  const tone = ratioToTone(activeCount, planQuota);
  const percent = planQuota > 0 ? Math.min(100, Math.round((activeCount / planQuota) * 100)) : 0;

  const fillClass =
    tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-success";

  return (
    <GlassCard>
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <MutedText>Plan usage</MutedText>
          <Text className="text-lg font-semibold tabular-nums">
            {activeCount} / {planQuota} domains
          </Text>
        </View>
        <Badge tone={tone === "success" ? "neutral" : tone}>
          <Text>{plan}</Text>
        </Badge>
      </View>
      <View
        accessibilityLabel={`${percent} percent of plan used`}
        accessibilityRole="progressbar"
        accessibilityValue={{ max: 100, min: 0, now: percent }}
        className="bg-control-secondary h-2 overflow-hidden rounded-full"
      >
        <View className={cn("h-full rounded-full", fillClass)} style={{ width: `${percent}%` }} />
      </View>
    </GlassCard>
  );
}
