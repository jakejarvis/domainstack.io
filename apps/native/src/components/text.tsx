import { Text as NativeText } from "react-native";

import { cn } from "@/lib/cn";

export function Text({
  children,
  className,
  numberOfLines,
  selectable,
}: {
  children: React.ReactNode;
  className?: string;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  return (
    <NativeText
      className={cn("text-text-primary text-base", className)}
      numberOfLines={numberOfLines}
      selectable={selectable}
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
}: {
  children: React.ReactNode;
  className?: string;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  return (
    <Text
      className={cn("text-text-secondary text-sm", className)}
      numberOfLines={numberOfLines}
      selectable={selectable}
    >
      {children}
    </Text>
  );
}
