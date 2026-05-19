import { Trans } from "@lingui/react/macro";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Symbol } from "@/components/symbol";
import { Text } from "@/components/text";

export function StepConfirmation({ domain }: { domain: string }) {
  const successColor = useCSSVariable("--color-success") as string;
  return (
    <View accessibilityLiveRegion="polite" className="items-center gap-4 py-6">
      <Symbol
        color={successColor}
        name={{ android: "check_circle", ios: "checkmark.circle.fill" }}
        size={56}
      />
      <View className="items-center gap-2">
        <Text variant="title2">
          <Trans>Domain verified!</Trans>
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          <Trans>
            <Text className="font-medium">{domain}</Text> has been added to your portfolio. You’ll
            get notifications when it’s about to expire.
          </Trans>
        </Text>
      </View>
    </View>
  );
}
