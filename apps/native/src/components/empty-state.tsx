import type { ReactNode } from "react";
import { View } from "react-native";

import { Button } from "./button";
import { MutedText, Text } from "./text";

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
      className="border-line bg-glass gap-4 overflow-hidden rounded-2xl border p-4"
      style={{ borderCurve: "continuous" }}
    >
      <View className={centered ? "items-center gap-2" : "gap-2"}>
        {icon ? <View className="mb-1">{icon}</View> : null}
        <Text className={centered ? "text-center text-lg font-semibold" : "text-lg font-semibold"}>
          {title}
        </Text>
        <MutedText className={centered ? "text-center" : undefined}>{body}</MutedText>
      </View>
      {actionLabel && onAction ? (
        <Button onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
