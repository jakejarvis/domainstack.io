import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Alert, View } from "react-native";

import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { formatDate } from "@/lib/format";

export function BillingSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const subscriptionKey = trpc.user.getSubscription.queryKey();
  const subscription = useQuery(trpc.user.getSubscription.queryOptions());

  const checkout = useMutation(
    trpc.user.createCheckoutUrl.mutationOptions({
      onError: (error) => Alert.alert("Could not start checkout", error.message),
    }),
  );

  const portal = useMutation(
    trpc.user.createPortalUrl.mutationOptions({
      onError: (error) => Alert.alert("Could not open subscription", error.message),
    }),
  );

  async function handleUpgrade() {
    const result = await checkout.mutateAsync({
      successUrl: Linking.createURL("/settings?upgraded=true"),
    });
    await WebBrowser.openAuthSessionAsync(result.url, Linking.createURL("/"));
    await queryClient.invalidateQueries({ queryKey: subscriptionKey });
  }

  async function handleManage() {
    const result = await portal.mutateAsync();
    await WebBrowser.openAuthSessionAsync(result.url, Linking.createURL("/"));
    await queryClient.invalidateQueries({ queryKey: subscriptionKey });
  }

  return (
    <GlassCard>
      <Text className="text-xl font-semibold">Plan</Text>
      {subscription.isPending ? (
        <SkeletonRows count={1} />
      ) : subscription.data ? (
        <View className="gap-2">
          <Text className="text-lg font-semibold">{subscription.data.plan}</Text>
          <MutedText>
            {subscription.data.activeCount} of {subscription.data.planQuota} active domains used
          </MutedText>
          {subscription.data.endsAt ? (
            <MutedText>Access ends {formatDate(subscription.data.endsAt)}</MutedText>
          ) : null}
          {subscription.data.plan === "free" ? (
            <Button loading={checkout.isPending} onPress={() => void handleUpgrade()}>
              <Text>Upgrade to Pro</Text>
            </Button>
          ) : (
            <Button
              loading={portal.isPending}
              onPress={() => void handleManage()}
              variant="secondary"
            >
              <Text>Manage subscription</Text>
            </Button>
          )}
        </View>
      ) : (
        <MutedText>Plan details are unavailable.</MutedText>
      )}
    </GlassCard>
  );
}
