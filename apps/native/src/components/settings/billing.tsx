import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";

import { Button } from "@/components/button";
import { GroupedSection } from "@/components/form/group";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export function BillingSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const subscriptionKey = trpc.user.getSubscription.queryKey();
  const subscription = useQuery(trpc.user.getSubscription.queryOptions());

  const checkout = useMutation(
    trpc.user.createCheckoutUrl.mutationOptions({
      onError: (error) =>
        toast.error({ title: "Could not start checkout", message: error.message }),
    }),
  );

  const portal = useMutation(
    trpc.user.createPortalUrl.mutationOptions({
      onError: (error) =>
        toast.error({ title: "Could not open subscription", message: error.message }),
    }),
  );

  async function handleUpgrade() {
    analytics.track("upgrade_clicked");
    const result = await checkout.mutateAsync({
      successUrl: Linking.createURL("/settings?upgraded=true"),
    });
    await WebBrowser.openAuthSessionAsync(result.url, Linking.createURL("/"));
    await queryClient.invalidateQueries({ queryKey: subscriptionKey });
  }

  async function handleManage() {
    analytics.track("customer_portal_opened");
    const result = await portal.mutateAsync();
    await WebBrowser.openAuthSessionAsync(result.url, Linking.createURL("/"));
    await queryClient.invalidateQueries({ queryKey: subscriptionKey });
  }

  return (
    <GroupedSection title="Plan">
      <View className="gap-3 p-4">
        {subscription.isPending ? (
          <SkeletonRows count={1} />
        ) : subscription.data ? (
          <>
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
          </>
        ) : (
          <MutedText>Plan details are unavailable.</MutedText>
        )}
      </View>
    </GroupedSection>
  );
}
