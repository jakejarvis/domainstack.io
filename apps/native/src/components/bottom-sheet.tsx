import {
  BottomSheetModal,
  type BottomSheetMethods,
  BottomSheetView,
} from "@expo/ui/community/bottom-sheet";
import type { Ref } from "react";
import { useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { MutedText, Text } from "./text";

export type AppBottomSheetRef = BottomSheetMethods;

export function AppBottomSheet({
  children,
  description,
  enablePanDownToClose = true,
  index = 0,
  onDismiss,
  ref,
  snapPoints = ["55%", "92%"],
  title,
}: {
  children: React.ReactNode;
  description?: string;
  enablePanDownToClose?: boolean;
  index?: number;
  onDismiss?: () => void;
  ref?: Ref<AppBottomSheetRef>;
  snapPoints?: Array<string | number>;
  title?: string;
}) {
  const insets = useSafeAreaInsets();
  const canvas = useCSSVariable("--color-canvas") as string;
  const isDark = useColorScheme() === "dark";

  return (
    <BottomSheetModal
      backgroundStyle={{ backgroundColor: canvas }}
      enableDynamicSizing={false}
      enablePanDownToClose={enablePanDownToClose}
      handleIndicatorStyle={{
        backgroundColor: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)",
      }}
      index={index}
      onDismiss={onDismiss}
      ref={ref}
      snapPoints={snapPoints}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <View className="flex-1 gap-4 px-4 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
          {title ? (
            <View className="gap-1">
              <Text className="text-xl font-semibold">{title}</Text>
              {description ? <MutedText>{description}</MutedText> : null}
            </View>
          ) : null}
          {children}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
