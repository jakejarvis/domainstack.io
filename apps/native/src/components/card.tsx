import { useColorScheme, View } from "react-native";

import { cn } from "@/lib/cn";

/**
 * Opaque grouped content surface (iOS `secondarySystemGroupedBackground`).
 * Glass/blur is reserved for chrome (headers, sheets, toolbars) — content
 * uses a solid raised surface so text stays legible and the screen has real
 * figure/ground separation. Continuous corners + a layered shadow (ambient +
 * direct) in light mode; dark mode leans on the border since shadows vanish.
 */
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  const isDark = useColorScheme() === "dark";

  return (
    <View
      className={cn("gap-4 rounded-2xl border border-border bg-card p-4", className)}
      style={{
        borderCurve: "continuous",
        boxShadow: isDark
          ? "none"
          : "0 1px 1px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.05)",
      }}
    >
      {children}
    </View>
  );
}
