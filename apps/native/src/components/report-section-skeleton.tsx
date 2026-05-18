import { View } from "react-native";

import { cn } from "@/lib/cn";

/** Loading placeholder that mirrors a {@link ReportSection}'s grouped chrome. */
export function ReportSectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View className="gap-1.5">
      <View className="ml-4 h-3 w-24 rounded bg-secondary" />
      <View
        className="gap-3 rounded-2xl border border-border bg-card p-4"
        style={{ borderCurve: "continuous" }}
      >
        {Array.from({ length: rows }, (_, index) => (
          <View
            className={cn("h-4 rounded bg-secondary", index % 2 === 0 ? "w-3/4" : "w-2/3")}
            key={index}
          />
        ))}
      </View>
    </View>
  );
}
