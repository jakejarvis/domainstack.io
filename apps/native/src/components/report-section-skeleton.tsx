import { View } from "react-native";

import { cn } from "@/lib/cn";

/** Loading placeholder that mirrors a {@link ReportSection}'s card chrome. */
export function ReportSectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View
      className="gap-3 overflow-hidden rounded-[20px] border border-border bg-card p-4"
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-row items-center gap-2.5">
        <View
          className="size-8 rounded-[10px] bg-secondary"
          style={{ borderCurve: "continuous" }}
        />
        <View className="gap-1.5">
          <View className="h-4 w-28 rounded bg-secondary" />
          <View className="h-2.5 w-20 rounded bg-secondary" />
        </View>
      </View>
      {Array.from({ length: rows }, (_, i) => ({
        key: `report-skeleton-${i}`,
        wide: i % 2 === 0,
      })).map((row) => (
        <View
          className={cn("h-4 rounded bg-secondary", row.wide ? "w-3/4" : "w-2/3")}
          key={row.key}
        />
      ))}
    </View>
  );
}
