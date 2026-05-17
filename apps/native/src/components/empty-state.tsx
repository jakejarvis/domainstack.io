import type { ReactNode } from "react";
import { View } from "react-native";

import { cn } from "@/lib/cn";

import { Button } from "./button";
import { Text } from "./text";

export function EmptyState({
  actionLabel,
  body,
  icon,
  onAction,
  title,
}: {
  actionLabel?: string;
  body: string;
  icon?: ReactNode;
  onAction?: () => void;
  title: string;
}) {
  const centered = Boolean(icon);
  return (
    <View
      className="bg-glass gap-4 overflow-hidden rounded-2xl border border-border p-4"
      style={{ borderCurve: "continuous" }}
    >
      <View className={centered ? "items-center gap-2" : "gap-2"}>
        {icon ? <View className="mb-1">{icon}</View> : null}
        <Text className={centered ? "text-center text-lg font-semibold" : "text-lg font-semibold"}>
          {title}
        </Text>
        <Text className={cn("text-sm text-muted-foreground", centered ? "text-center" : undefined)}>
          {body}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Button onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
