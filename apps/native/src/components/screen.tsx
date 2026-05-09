import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@/lib/cn";

export function Screen({
  children,
  className,
  scroll = true,
}: {
  children: React.ReactNode;
  className?: string;
  scroll?: boolean;
}) {
  const body = <View className={cn("gap-5 px-4 pt-3 pb-8", className)}>{children}</View>;

  return (
    <SafeAreaView className="bg-canvas flex-1" edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          alwaysBounceVertical={false}
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}
