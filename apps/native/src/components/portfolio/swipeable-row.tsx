import { useCallback, useRef } from "react";
import { Pressable, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { DomainRow } from "@/components/domain-row";
import { Text } from "@/components/text";
import { useSelectionMode } from "@/hooks/use-portfolio-selection";
import { cn } from "@/lib/cn";
import type { PortfolioDomain } from "@/lib/portfolio";

const ACTION_WIDTH = 96;

export function SwipeableRow({
  domain,
  onArchive,
  onLongPress,
  onMute,
  onPress,
}: {
  domain: PortfolioDomain;
  onArchive: (domain: PortfolioDomain) => void;
  onLongPress?: (domain: PortfolioDomain) => void;
  onMute: (domain: PortfolioDomain) => void;
  onPress: (domain: PortfolioDomain) => void;
}) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const selectionMode = useSelectionMode();
  const enabled = selectionMode === "idle";

  const handleMutePress = useCallback(() => {
    swipeableRef.current?.close();
    onMute(domain);
  }, [domain, onMute]);

  const handleArchivePress = useCallback(() => {
    swipeableRef.current?.close();
    onArchive(domain);
  }, [domain, onArchive]);

  const muteLabel = domain.muted ? "Unmute" : "Mute";

  const renderLeftActions = useCallback(
    () => (
      <View className="flex-row items-stretch pr-2">
        <Pressable
          accessibilityRole="button"
          className={cn(
            "items-center justify-center rounded-2xl bg-warning px-4",
            "min-w-[" + ACTION_WIDTH + "px]",
          )}
          onPress={handleMutePress}
          style={{ width: ACTION_WIDTH }}
        >
          <Text className="text-warning-text font-semibold">{muteLabel}</Text>
        </Pressable>
      </View>
    ),
    [handleMutePress, muteLabel],
  );

  const renderRightActions = useCallback(
    () => (
      <View className="flex-row items-stretch pl-2">
        <Pressable
          accessibilityRole="button"
          className="items-center justify-center rounded-2xl bg-danger px-4"
          onPress={handleArchivePress}
          style={{ width: ACTION_WIDTH }}
        >
          <Text className="text-danger-text font-semibold">Archive</Text>
        </Pressable>
      </View>
    ),
    [handleArchivePress],
  );

  return (
    <View className="px-4 pb-3">
      <ReanimatedSwipeable
        enabled={enabled}
        friction={2}
        leftThreshold={64}
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        rightThreshold={64}
      >
        <DomainRow domain={domain} onLongPress={onLongPress} onPress={onPress} />
      </ReanimatedSwipeable>
    </View>
  );
}
