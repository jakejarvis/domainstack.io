import { router } from "expo-router";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
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
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
        <GlassCard>
          <View className="gap-1">
            <Text className="text-base font-semibold">
              Your Pro plan ends in {variant.daysLeft} {variant.daysLeft === 1 ? "day" : "days"}
            </Text>
            <Text className="text-sm text-muted-foreground">
              Resubscribe to keep tracking your full portfolio without interruption.
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button className="flex-1" onPress={goToSettings}>
              <Text>Resubscribe</Text>
            </Button>
            <Button className="flex-1" onPress={goToSettings} variant="secondary">
              <Text>Manage</Text>
            </Button>
          </View>
        </GlassCard>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
      <GlassCard>
        <View className="gap-1">
          <Text className="text-base font-semibold">You've reached your plan limit</Text>
          <Text className="text-sm text-muted-foreground">
            Upgrade to Pro to track more domains and unlock notifications.
          </Text>
        </View>
        <Button onPress={goToSettings}>
          <Text>Upgrade</Text>
        </Button>
      </GlassCard>
    </Animated.View>
  );
}
