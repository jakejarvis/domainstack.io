import type { StyleProp, TextStyle } from "react-native";
import { Text as NativeText } from "react-native";

import { cn } from "@/lib/cn";

export function Text({
  children,
  className,
  numberOfLines,
  selectable,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  numberOfLines?: number;
  selectable?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <NativeText
      className={cn("text-text-primary text-base", className)}
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={style}
    >
      {children}
    </NativeText>
  );
}

export function MutedText({
  children,
  className,
  numberOfLines,
  selectable,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  numberOfLines?: number;
  selectable?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      className={cn("text-text-secondary text-sm", className)}
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={style}
    >
      {children}
    </Text>
  );
}
