import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Button } from "./button";
import { Symbol, type SymbolName } from "./symbol";
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
  icon?: SymbolName;
  onAction?: () => void;
  title: string;
}) {
  const muted = useCSSVariable("--color-muted-foreground") as string;
  return (
    <View
      className="items-center gap-5 rounded-2xl border border-border bg-card px-6 py-10"
      style={{ borderCurve: "continuous" }}
    >
      <View className="items-center gap-2">
        {icon ? (
          <View className="mb-1">
            <Symbol color={muted} name={icon} size={44} />
          </View>
        ) : null}
        <Text variant="title3" className="text-center">
          {title}
        </Text>
        <Text className="text-center text-sm text-muted-foreground">{body}</Text>
      </View>
      {actionLabel && onAction ? (
        <Button className="self-stretch" onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
