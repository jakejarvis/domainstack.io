import { Trans, useLingui } from "@lingui/react/macro";
import { View } from "react-native";

import { Text } from "@/components/text";

/**
 * Plan-usage nudge. A gold-tinted panel (not a raised card) with a mono
 * counter and a thin track — the design's quota affordance. Over-quota flips
 * the panel to the destructive tint.
 */
export function QuotaMeter({
  activeCount,
  plan,
  planQuota,
}: {
  activeCount: number;
  plan: string;
  planQuota: number;
}) {
  const { t } = useLingui();
  const percent = planQuota > 0 ? Math.min(100, Math.round((activeCount / planQuota) * 100)) : 0;
  const over = planQuota > 0 && activeCount >= planQuota;

  const panel = over
    ? "border-destructive-border bg-destructive-surface"
    : "border-accent-gold/25 bg-accent-gold/10";
  const accentText = over ? "text-destructive" : "text-accent-gold";
  const trackBg = over ? "bg-destructive/20" : "bg-accent-gold/20";
  const fillBg = over ? "bg-destructive" : "bg-accent-gold";

  return (
    <View
      className={`gap-2 rounded-2xl border p-3.5 ${panel}`}
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="text-sm font-medium">{plan}</Text>
        <Text className="text-xs text-muted-foreground">
          <Trans>
            <Text className={`font-mono text-sm font-medium tabular-nums ${accentText}`}>
              {activeCount}
            </Text>{" "}
            / {planQuota} domains
          </Trans>
        </Text>
      </View>
      <View
        accessibilityLabel={t`${percent} percent of plan used`}
        accessibilityRole="progressbar"
        accessibilityValue={{ max: 100, min: 0, now: percent }}
        className={`h-1 overflow-hidden rounded-full ${trackBg}`}
      >
        <View className={`h-full rounded-full ${fillBg}`} style={{ width: `${percent}%` }} />
      </View>
    </View>
  );
}
