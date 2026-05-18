import { View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Symbol, type SymbolName } from "@/components/symbol";
import { Text } from "@/components/text";
import { cn } from "@/lib/cn";

/**
 * The report's section accent palette. Each domain report section owns a hue
 * used as a tinted icon chip, a count pill, and the signature blurred glow
 * that bleeds from the top edge of the card — the through-line that ties the
 * native report to the web design system.
 */
export type ReportAccent =
  | "blue"
  | "indigo"
  | "green"
  | "purple"
  | "orange"
  | "cyan"
  | "pink"
  | "slate"
  | "red"
  | "gold";

// Literal class strings (not interpolated) so the Tailwind scanner emits the
// `--color-accent-*` opacity utilities used here.
const ACCENT_STYLES: Record<ReportAccent, { chip: string; count: string; cssVar: string }> = {
  blue: {
    chip: "bg-accent-blue/12",
    count: "bg-accent-blue/15 text-accent-blue",
    cssVar: "--color-accent-blue",
  },
  indigo: {
    chip: "bg-accent-indigo/12",
    count: "bg-accent-indigo/15 text-accent-indigo",
    cssVar: "--color-accent-indigo",
  },
  green: {
    chip: "bg-accent-green/12",
    count: "bg-accent-green/15 text-accent-green",
    cssVar: "--color-accent-green",
  },
  purple: {
    chip: "bg-accent-purple/12",
    count: "bg-accent-purple/15 text-accent-purple",
    cssVar: "--color-accent-purple",
  },
  orange: {
    chip: "bg-accent-orange/12",
    count: "bg-accent-orange/15 text-accent-orange",
    cssVar: "--color-accent-orange",
  },
  cyan: {
    chip: "bg-accent-cyan/12",
    count: "bg-accent-cyan/15 text-accent-cyan",
    cssVar: "--color-accent-cyan",
  },
  pink: {
    chip: "bg-accent-pink/12",
    count: "bg-accent-pink/15 text-accent-pink",
    cssVar: "--color-accent-pink",
  },
  slate: {
    chip: "bg-accent-slate/12",
    count: "bg-accent-slate/15 text-accent-slate",
    cssVar: "--color-accent-slate",
  },
  red: {
    chip: "bg-accent-red/12",
    count: "bg-accent-red/15 text-accent-red",
    cssVar: "--color-accent-red",
  },
  gold: {
    chip: "bg-accent-gold/12",
    count: "bg-accent-gold/15 text-accent-gold",
    cssVar: "--color-accent-gold",
  },
};

/**
 * Domain report section. A self-contained card with a hairline border, a
 * tinted accent icon chip, optional subtitle/count, and the signature
 * accent-glow halo bleeding from the top edge (clipped by the card). Fades in
 * as its Suspense boundary resolves so sections don't pop in.
 */
export function ReportSection({
  accent = "blue",
  children,
  count,
  icon,
  subtitle,
  title,
  trailing,
}: {
  accent?: ReportAccent;
  children: React.ReactNode;
  count?: number;
  icon: SymbolName;
  subtitle?: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  const styles = ACCENT_STYLES[accent];
  const accentColor = useCSSVariable(styles.cssVar) as string;

  return (
    <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}>
      <View
        className="overflow-hidden rounded-[20px] border border-border bg-card"
        style={{ borderCurve: "continuous" }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -26,
            left: 18,
            right: 18,
            height: 52,
            borderRadius: 999,
            backgroundColor: accentColor,
            opacity: 0.5,
            boxShadow: `0 0 38px 8px ${accentColor}`,
          }}
        />
        <View className="gap-3 p-4">
          <View className="flex-row items-center gap-2.5">
            <View
              className={cn("size-8 items-center justify-center rounded-[10px]", styles.chip)}
              style={{ borderCurve: "continuous" }}
            >
              <Symbol color={accentColor} name={icon} size={17} weight="medium" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-base font-semibold" numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {count != null ? (
              <View className={cn("rounded-full px-2 py-0.5", styles.count.split(" ")[0])}>
                <Text
                  className={cn("text-xs font-semibold tabular-nums", styles.count.split(" ")[1])}
                >
                  {count}
                </Text>
              </View>
            ) : null}
            {trailing}
          </View>
          {children}
        </View>
      </View>
    </Animated.View>
  );
}
