import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { View } from "react-native";

import { MutedText, Text } from "@/components/text";
import { useCSSVariable } from "@/tw";

export function StepConfirmation({ domain }: { domain: string }) {
  const successColor = useCSSVariable("--color-success");
  return (
    <View accessibilityLiveRegion="polite" className="items-center gap-4 py-6">
      <MaterialIcons color={successColor} name="check-circle" size={56} />
      <View className="items-center gap-2">
        <Text className="text-2xl font-semibold">Domain verified!</Text>
        <MutedText className="text-center">
          <Text className="font-medium">{domain}</Text> has been added to your portfolio. You’ll get
          notifications when it’s about to expire.
        </MutedText>
      </View>
    </View>
  );
}
