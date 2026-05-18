import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Symbol, type SymbolName } from "@/components/symbol";
import { Text } from "@/components/text";
import { cn } from "@/lib/cn";

type Variant = "info" | "warn";

const CONFIG: Record<Variant, { box: string; text: string; cssVar: string; icon: SymbolName }> = {
  info: {
    box: "border-info-border bg-info-surface",
    cssVar: "--color-info",
    icon: { android: "info", ios: "info.circle.fill" },
    text: "text-info",
  },
  warn: {
    box: "border-warning-border bg-warning-surface",
    cssVar: "--color-warning",
    icon: { android: "warning", ios: "exclamationmark.triangle.fill" },
    text: "text-warning",
  },
};

/** Inline informational banner — the design's `.callout` (info / warn). */
export function Callout({
  children,
  icon,
  variant = "info",
}: {
  children: React.ReactNode;
  icon?: SymbolName;
  variant?: Variant;
}) {
  const config = CONFIG[variant];
  const color = useCSSVariable(config.cssVar) as string;

  return (
    <View
      className={cn("flex-row gap-2.5 rounded-xl border p-3", config.box)}
      style={{ borderCurve: "continuous" }}
    >
      <View className="pt-px">
        <Symbol color={color} name={icon ?? config.icon} size={18} />
      </View>
      <Text className={cn("flex-1 text-[13px] leading-5", config.text)}>{children}</Text>
    </View>
  );
}
