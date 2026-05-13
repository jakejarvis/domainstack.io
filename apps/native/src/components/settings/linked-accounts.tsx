import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { Alert, Platform, View } from "react-native";

import { Button } from "@/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProviderIcon } from "@/components/provider-icon";
import { MutedText, Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { type AuthProvider, getOtaConfig, linkProvider, unlinkProvider } from "@/lib/auth";
import { getEnabledNativeAuthProviders } from "@/lib/auth-providers";
import { googleNativeConfig } from "@/lib/env";
import { useCSSVariable } from "@/tw";

const OTA_CONFIG_QUERY_KEY = ["auth", "ota-config"] as const;

function isAuthCanceled(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_REQUEST_CANCELED";
}

export function LinkedAccountsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const iconColor = useCSSVariable("--color-text-primary");
  const [appleAuthAvailable, setAppleAuthAvailable] = useState<boolean | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<AuthProvider | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<AuthProvider | null>(null);

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
  }, []);

  const otaConfig = useQuery({
    queryFn: getOtaConfig,
    queryKey: OTA_CONFIG_QUERY_KEY,
    staleTime: 1000 * 60 * 5,
  });
  const linkedAccountsKey = trpc.user.getLinkedAccounts.queryKey();
  const linkedAccounts = useQuery(trpc.user.getLinkedAccounts.queryOptions());

  const invalidateLinkedAccounts = () =>
    queryClient.invalidateQueries({ queryKey: linkedAccountsKey });

  const unlink = useMutation({
    mutationFn: ({ providerId }: { providerId: AuthProvider }) => unlinkProvider(providerId),
    onSettled: invalidateLinkedAccounts,
  });

  const providerOptions = otaConfig.data
    ? getEnabledNativeAuthProviders(otaConfig.data.authProviders, googleNativeConfig, {
        appleAuthAvailable: appleAuthAvailable === true,
        platform: Platform.OS,
      })
    : [];

  const linkedProviderIds = new Set((linkedAccounts.data ?? []).map((a) => a.providerId));
  const linkedCount = linkedAccounts.data?.length ?? 0;

  async function handleLink(provider: AuthProvider) {
    setLinkingProvider(provider);
    try {
      const result = await linkProvider(provider);
      if (result.error) {
        throw new Error(result.error.message ?? `Unable to link ${provider}.`);
      }
      await invalidateLinkedAccounts();
    } catch (error) {
      if (!isAuthCanceled(error)) {
        analytics.trackException(error, { action: "link_account", provider });
        Alert.alert(
          "Could not link account",
          error instanceof Error ? error.message : "Unable to link this provider.",
        );
      }
    } finally {
      setLinkingProvider(null);
    }
  }

  async function handleUnlinkConfirm() {
    if (!pendingUnlink) return;
    try {
      const result = await unlink.mutateAsync({ providerId: pendingUnlink });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to unlink this provider.");
      }
      setPendingUnlink(null);
    } catch (error) {
      analytics.trackException(error, { action: "unlink_account", provider: pendingUnlink });
      const message = error instanceof Error ? error.message : "Unable to unlink this provider.";
      Alert.alert("Could not unlink account", message);
    }
  }

  return (
    <View className="gap-3">
      <Text className="font-semibold">Linked sign-in accounts</Text>
      {otaConfig.isPending || linkedAccounts.isPending ? (
        <MutedText>Loading providers…</MutedText>
      ) : providerOptions.length === 0 ? (
        <MutedText>No sign-in providers are available right now.</MutedText>
      ) : (
        providerOptions.map((provider) => {
          const isLinked = linkedProviderIds.has(provider.id);
          const unlinkDisabled = isLinked && linkedCount < 2;
          return (
            <View
              className="border-line bg-canvas-2 flex-row items-center gap-3 rounded-xl border p-3"
              key={provider.id}
            >
              <ProviderIcon color={iconColor} provider={provider.id} size={22} />
              <View className="flex-1 gap-1">
                <Text className="font-semibold">{provider.name}</Text>
                {isLinked && unlinkDisabled ? (
                  <MutedText className="text-xs">Must keep at least one sign-in method.</MutedText>
                ) : null}
              </View>
              {isLinked ? (
                <Button
                  disabled={unlinkDisabled || unlink.isPending}
                  loading={unlink.isPending && pendingUnlink === provider.id}
                  onPress={() => setPendingUnlink(provider.id)}
                  variant="secondary"
                >
                  <Text>Unlink</Text>
                </Button>
              ) : (
                <Button
                  loading={linkingProvider === provider.id}
                  onPress={() => void handleLink(provider.id)}
                  variant="primary"
                >
                  <Text>Link</Text>
                </Button>
              )}
            </View>
          );
        })
      )}
      <ConfirmDialog
        confirmLabel="Unlink"
        description={
          pendingUnlink
            ? `You won't be able to sign in with ${pendingUnlink} again until you re-link it.`
            : undefined
        }
        destructive
        loading={unlink.isPending}
        onConfirm={handleUnlinkConfirm}
        onOpenChange={(open) => {
          if (!open) setPendingUnlink(null);
        }}
        open={pendingUnlink !== null}
        title={pendingUnlink ? `Unlink ${pendingUnlink}?` : "Unlink account?"}
      />
    </View>
  );
}
