import { createContext, useContext } from "react";
import { Text as NativeText, type TextProps } from "react-native";

import { cn } from "@/lib/cn";

/**
 * React Native does not cascade text color from a parent `View`/`Pressable`
 * to nested `<Text>`. Colored containers (Button, Badge) publish the label
 * classes here so the `Text` primitive can pick them up. Mirrors the
 * shadcn/react-native-reusables `TextClassContext` pattern.
 */
export const TextClassContext = createContext<string | undefined>(undefined);

/**
 * Thin themed wrapper over RN `Text`: applies the dark-mode-safe default
 * color, consumes {@link TextClassContext} so colored containers can publish
 * their label color, and forwards every native `Text` prop. Style with
 * Tailwind via `className` (e.g. `text-sm text-muted-foreground`).
 */
export function Text({ className, ...props }: TextProps) {
  const contextClassName = useContext(TextClassContext);
  return (
    <NativeText
      className={cn("text-base text-foreground", contextClassName, className)}
      {...props}
    />
  );
}
