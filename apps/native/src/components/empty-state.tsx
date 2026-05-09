import { View } from "react-native";

import { Button } from "./button";
import { GlassCard } from "./glass-card";
import { MutedText, Text } from "./text";

export function EmptyState({
  actionLabel,
  body,
  onAction,
  title,
}: {
  actionLabel?: string;
  body: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <GlassCard>
      <View className="gap-2">
        <Text className="text-lg font-semibold">{title}</Text>
        <MutedText>{body}</MutedText>
      </View>
      {actionLabel && onAction && <Button onPress={onAction}>{actionLabel}</Button>}
    </GlassCard>
  );
}
