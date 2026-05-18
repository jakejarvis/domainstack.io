import { createContext, useContext } from "react";
import { Text as NativeText, type TextProps } from "react-native";

import { cn, cva, type VariantProps } from "@/lib/cn";

/**
 * React Native does not cascade text color from a parent `View`/`Pressable`
 * to nested `<Text>`. Colored containers (Button, Badge) publish the label
 * classes here so the `Text` primitive can pick them up. Mirrors the
 * shadcn/react-native-reusables `TextClassContext` pattern.
 */
export const TextClassContext = createContext<string | undefined>(undefined);

/**
 * iOS-aligned type ramp. Roles map to the Apple text styles so headings stay
 * consistent instead of every screen picking a raw `text-*` size. Variants
 * set size/weight only — color stays `--color-foreground` (or whatever a
 * colored container or explicit `className` overrides it to).
 */
const textVariants = cva({
  base: "text-foreground",
  variants: {
    variant: {
      largeTitle: "text-4xl font-bold",
      title: "text-3xl font-semibold",
      title2: "text-2xl font-semibold",
      title3: "text-xl font-semibold",
      headline: "text-base font-semibold",
      body: "text-base",
      callout: "text-[15px]",
      subhead: "text-sm",
      footnote: "text-[13px]",
      caption: "text-xs",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

type TextVariant = NonNullable<VariantProps<typeof textVariants>["variant"]>;

/**
 * Thin themed wrapper over RN `Text`: applies the type ramp + dark-mode-safe
 * default color, consumes {@link TextClassContext} so colored containers can
 * publish their label color, and forwards every native `Text` prop. Tune with
 * `variant` for role, `className` for everything else.
 */
export function Text({ className, variant, ...props }: TextProps & { variant?: TextVariant }) {
  const contextClassName = useContext(TextClassContext);
  return (
    <NativeText className={cn(textVariants({ variant }), contextClassName, className)} {...props} />
  );
}
