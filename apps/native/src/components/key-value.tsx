import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Pressable, View } from "react-native";

import { cn } from "@/lib/cn";

import { MutedText, Text } from "./text";

export function KeyValue({
  label,
  value,
  mono = false,
  copyable = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copyable?: boolean;
  className?: string;
}) {
  const handleLongPress = useCallback(async () => {
    if (!copyable) return;
    if (typeof value !== "string") return;
    await Clipboard.setStringAsync(value);
    if (process.env.EXPO_OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [copyable, value]);

  const valueNode =
    typeof value === "string" || typeof value === "number" ? (
      <Text className={cn("text-sm", mono && "font-mono")} selectable>
        {value}
      </Text>
    ) : (
      value
    );

  const body = (
    <View className={cn("gap-1", className)}>
      <MutedText className="text-xs tracking-wide uppercase">{label}</MutedText>
      {valueNode}
    </View>
  );

  if (!copyable) return body;

  return (
    <Pressable accessibilityRole="button" delayLongPress={400} onLongPress={handleLongPress}>
      {body}
    </Pressable>
  );
}
