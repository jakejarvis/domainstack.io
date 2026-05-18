import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { Button } from "@/components/button";
import { GroupedSection } from "@/components/form/group";
import { SkeletonRows } from "@/components/skeleton";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  addProEntitlementListener,
  getProOffering,
  isPurchasesEnabled,
  purchaseProPackage,
  restoreProPurchases,
} from "@/lib/purchases";
import { toast } from "@/lib/toast";

const WEB_URL = "https://domainstack.io";

// Native store subscription-management deep links (managing an EXISTING
// subscription — not a purchase surface, so App Store policy compliant).
const STORE_SUBSCRIPTIONS_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";

export function BillingSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const subscriptionKey = trpc.user.getSubscription.queryKey();
  const subscription = useQuery(trpc.user.getSubscription.queryOptions());

  const plan = subscription.data?.plan;
  const provider = subscription.data?.provider ?? null;
  const purchasesEnabled = isPurchasesEnabled();

  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // RevenueCat is the source of truth for the device, but our server
  // entitlement is webhook-derived and can lag the purchase by a moment.
  // Invalidate immediately and again after a short delay to reconcile.
  function refreshSubscription() {
    void queryClient.invalidateQueries({ queryKey: subscriptionKey });
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKey });
    }, 4000);
  }

  // Refetch whenever the RevenueCat entitlement changes (purchase, renewal,
  // restore from another device) while this screen is mounted.
  useEffect(() => {
    if (!purchasesEnabled) return;
    return addProEntitlementListener(() => {
      void queryClient.invalidateQueries({
        queryKey: trpc.user.getSubscription.queryKey(),
      });
    });
  }, [purchasesEnabled, queryClient, trpc]);

  const offering = useQuery({
    queryKey: ["revenuecat-offering"],
    queryFn: getProOffering,
    enabled: plan === "free" && purchasesEnabled,
    staleTime: 1000 * 60 * 5,
  });

  async function handlePurchase(pkg: PurchasesPackage) {
    analytics.track("upgrade_clicked");
    setBusyPackageId(pkg.identifier);
    try {
      const { cancelled } = await purchaseProPackage(pkg);
      if (!cancelled) {
        refreshSubscription();
        toast.success({ title: "Welcome to Pro", message: "Your subscription is active." });
      }
    } catch (error) {
      toast.error({
        title: "Purchase failed",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const restored = await restoreProPurchases();
      analytics.track("purchases_restored");
      if (restored) {
        refreshSubscription();
        toast.success({ title: "Purchases restored" });
      } else {
        toast.info({ title: "Nothing to restore", message: "No active purchases were found." });
      }
    } catch (error) {
      toast.error({
        title: "Restore failed",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setRestoring(false);
    }
  }

  async function handleManageOnStore() {
    analytics.track("manage_subscription_opened");
    await Linking.openURL(STORE_SUBSCRIPTIONS_URL);
  }

  async function handleManageOnWeb() {
    analytics.track("manage_subscription_opened");
    await WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard`);
  }

  return (
    <GroupedSection title="Plan">
      <View className="gap-3 p-4">
        {subscription.isPending ? (
          <SkeletonRows count={1} />
        ) : subscription.data ? (
          <>
            <Text className="text-lg font-semibold">{subscription.data.plan}</Text>
            <Text className="text-sm text-muted-foreground">
              {subscription.data.activeCount} of {subscription.data.planQuota} active domains used
            </Text>
            {subscription.data.endsAt ? (
              <Text className="text-sm text-muted-foreground">
                Access ends {formatDate(subscription.data.endsAt)}
              </Text>
            ) : null}

            {plan === "pro" && provider === "polar" ? (
              // Double-billing guard: this user pays via the web (Polar).
              // Never offer an in-app purchase — point them to the web to
              // manage the existing subscription.
              <>
                <Text className="text-sm text-muted-foreground">
                  You’re subscribed through the web app. Manage your subscription at domainstack.io.
                </Text>
                <Button variant="secondary" onPress={() => void handleManageOnWeb()}>
                  <Text>Manage on domainstack.io</Text>
                </Button>
              </>
            ) : plan === "pro" ? (
              <Button variant="secondary" onPress={() => void handleManageOnStore()}>
                <Text>Manage subscription</Text>
              </Button>
            ) : !purchasesEnabled ? (
              <Text className="text-sm text-muted-foreground">
                In-app purchases are unavailable right now. Please try again later.
              </Text>
            ) : offering.isPending ? (
              <SkeletonRows count={1} />
            ) : !offering.data ? (
              <Text className="text-sm text-muted-foreground">
                In-app purchases are unavailable right now. Please try again later.
              </Text>
            ) : (
              <>
                {offering.data.availablePackages.map((pkg) => (
                  <Button
                    key={pkg.identifier}
                    loading={busyPackageId === pkg.identifier}
                    disabled={busyPackageId !== null || restoring}
                    onPress={() => void handlePurchase(pkg)}
                  >
                    <Text>Upgrade to Pro — {pkg.product.priceString}</Text>
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  loading={restoring}
                  disabled={busyPackageId !== null}
                  onPress={() => void handleRestore()}
                >
                  <Text>Restore purchases</Text>
                </Button>
              </>
            )}
          </>
        ) : (
          <Text className="text-sm text-muted-foreground">Plan details are unavailable.</Text>
        )}
      </View>
    </GroupedSection>
  );
}
