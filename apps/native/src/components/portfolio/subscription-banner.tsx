import { Plural, Trans } from "@lingui/react/macro";
import { router } from "expo-router";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Text } from "@/components/text";
import { daysUntil } from "@/lib/format";

type Variant = { kind: "ending"; daysLeft: number } | { kind: "at-limit" } | { kind: "none" };

function pickVariant(subscription: { endsAt: Date | string | null; canAddMore: boolean }): Variant {
  if (subscription.endsAt) {
    const days = daysUntil(subscription.endsAt);
    if (days != null && days >= 0 && days <= 14) {
      return { kind: "ending", daysLeft: days };
    }
  }
  if (!subscription.canAddMore) {
    return { kind: "at-limit" };
  }
  return { kind: "none" };
}

export function SubscriptionBanner({
  subscription,
}: {
  subscription: {
    endsAt: Date | string | null;
    canAddMore: boolean;
  };
}) {
  const variant = pickVariant(subscription);
  if (variant.kind === "none") return null;

  const goToSettings = () => router.push("/settings");

  if (variant.kind === "ending") {
    return (
      <Animated.View
        entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(160).reduceMotion(ReduceMotion.System)}
      >
        <Card>
          <View className="gap-1">
            <Text className="text-base font-semibold">
              <Plural
                value={variant.daysLeft}
                _0="Your Pro plan ends today"
                one="Your Pro plan ends in # day"
                other="Your Pro plan ends in # days"
              />
            </Text>
            <Text className="text-sm text-muted-foreground">
              <Trans>Resubscribe to keep tracking your full portfolio without interruption.</Trans>
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button className="flex-1" onPress={goToSettings}>
              <Text>
                <Trans>Resubscribe</Trans>
              </Text>
            </Button>
            <Button className="flex-1" onPress={goToSettings} variant="secondary">
              <Text>
                <Trans>Manage</Trans>
              </Text>
            </Button>
          </View>
        </Card>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(160).reduceMotion(ReduceMotion.System)}
    >
      <Card>
        <View className="gap-1">
          <Text className="text-base font-semibold">
            <Trans>You’ve reached your plan limit</Trans>
          </Text>
          <Text className="text-sm text-muted-foreground">
            <Trans>Upgrade to Pro to track more domains and unlock notifications.</Trans>
          </Text>
        </View>
        <Button onPress={goToSettings}>
          <Text>
            <Trans>Upgrade</Trans>
          </Text>
        </Button>
      </Card>
    </Animated.View>
  );
}
