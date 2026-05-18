import type { Stack } from "expo-router/stack";
import type { ComponentProps } from "react";
import { useColorScheme } from "react-native";
import { useCSSVariable } from "uniwind";

type StackScreenOptions = ComponentProps<typeof Stack>["screenOptions"];

/**
 * Shared native-stack chrome. A single source of truth so every stack reads
 * the same theme tokens instead of re-deriving them. The header is a true
 * iOS-style translucent blur bar — `headerTransparent` + `headerBlurEffect`
 * with no solid background (a translucent solid *plus* a blur, as before,
 * fights itself and reads muddy). Content scrolls under it via each screen's
 * `contentInsetAdjustmentBehavior="automatic"`.
 */
export function useStackScreenOptions(): StackScreenOptions {
  const canvas = useCSSVariable("--color-background") as string;
  const text = useCSSVariable("--color-foreground") as string;
  const isDark = useColorScheme() === "dark";

  return {
    contentStyle: { backgroundColor: canvas },
    headerBackButtonDisplayMode: "minimal",
    headerBlurEffect: isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight",
    headerLargeStyle: { backgroundColor: canvas },
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: "transparent" },
    headerTintColor: text,
    headerTransparent: true,
  };
}
