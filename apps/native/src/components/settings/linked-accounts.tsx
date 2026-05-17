import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/button";
import { GroupedRow, GroupedSection } from "@/components/form/group";
import { ProviderIcon } from "@/components/provider-icon";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import {
  type AuthProvider,
  getOtaConfig,
  linkProvider,
  linkProviderWithAppleToken,
  linkProviderWithGoogleToken,
  OTA_CONFIG_QUERY_KEY,
  unlinkProvider,
} from "@/lib/auth";
import { getEnabledNativeAuthProviders, type NativeAuthProviderOption } from "@/lib/auth-providers";
import { googleNativeConfig } from "@/lib/env";
import { getGoogleIdentityToken } from "@/lib/google-auth";
import { confirm } from "@/lib/native-confirm";
import { createAuthNonce } from "@/lib/nonce";
import { toast } from "@/lib/toast";

function isAuthCanceled(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_REQUEST_CANCELED";
}

export function LinkedAccountsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const iconColor = useCSSVariable("--color-foreground") as string;
  const [appleAuthAvailable, setAppleAuthAvailable] = useState<boolean | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<AuthProvider | null>(null);
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

  async function handleLink(provider: NativeAuthProviderOption) {
    setLinkingProvider(provider.id);
    analytics.track("link_account_clicked", { provider: provider.id });
    try {
      let result: Awaited<ReturnType<typeof linkProvider>>;
      if (provider.id === "apple" && appleAuthAvailable) {
        const { hashed: nonce } = await createAuthNonce();
        const credential = await AppleAuthentication.signInAsync({
          nonce,
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          throw new Error("Apple did not return an identity token.");
        }
        result = await linkProviderWithAppleToken(credential.identityToken, nonce);
      } else if (provider.id === "google" && provider.supportsNativeIdToken) {
        const token = await getGoogleIdentityToken(googleNativeConfig);
        if (!token) return; // user cancelled the native sheet
        result = await linkProviderWithGoogleToken(token);
      } else {
        result = await linkProvider(provider.id);
      }
      if (result.error) {
        throw new Error(result.error.message ?? `Unable to link ${provider.id}.`);
      }
      await invalidateLinkedAccounts();
      toast.success("Account linked");
    } catch (error) {
      if (!isAuthCanceled(error)) {
        analytics.trackException(error, { action: "link_account", provider: provider.id });
        toast.error({
          title: "Could not link account",
          message: error instanceof Error ? error.message : "Unable to link this provider.",
        });
      }
    } finally {
      setLinkingProvider(null);
    }
  }

  async function handleUnlink(provider: AuthProvider) {
    const accepted = await confirm({
      confirmLabel: "Unlink",
      destructive: true,
      message: `You won't be able to sign in with ${provider} again until you re-link it.`,
      title: `Unlink ${provider}?`,
    });
    if (!accepted) return;
    setUnlinkingProvider(provider);
    try {
      const result = await unlink.mutateAsync({ providerId: provider });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to unlink this provider.");
      }
    } catch (error) {
      analytics.trackException(error, { action: "unlink_account", provider });
      const message = error instanceof Error ? error.message : "Unable to unlink this provider.";
      toast.error({ title: "Could not unlink account", message });
    } finally {
      setUnlinkingProvider(null);
    }
  }

  if (otaConfig.isPending || linkedAccounts.isPending) {
    return (
      <GroupedSection title="Sign-in methods">
        <View className="p-3">
          <Text className="text-sm text-muted-foreground">Loading providers…</Text>
        </View>
      </GroupedSection>
    );
  }

  if (providerOptions.length === 0) {
    return (
      <GroupedSection title="Sign-in methods">
        <View className="p-3">
          <Text className="text-sm text-muted-foreground">
            No sign-in providers are available right now.
          </Text>
        </View>
      </GroupedSection>
    );
  }

  return (
    <GroupedSection
      footer="Add a second sign-in method so you can recover access even if one provider is unavailable."
      title="Sign-in methods"
    >
      {providerOptions.map((provider) => {
        const isLinked = linkedProviderIds.has(provider.id);
        const unlinkDisabled = isLinked && linkedCount < 2;
        return (
          <GroupedRow
            key={provider.id}
            trailing={
              isLinked ? (
                <Button
                  disabled={unlinkDisabled || unlink.isPending}
                  loading={unlinkingProvider === provider.id}
                  onPress={() => void handleUnlink(provider.id)}
                  variant="secondary"
                >
                  <Text>Unlink</Text>
                </Button>
              ) : (
                <Button
                  loading={linkingProvider === provider.id}
                  onPress={() => void handleLink(provider)}
                  variant="primary"
                >
                  <Text>Link</Text>
                </Button>
              )
            }
          >
            <ProviderIcon color={iconColor} provider={provider.id} size={22} />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="font-semibold" numberOfLines={1}>
                {provider.name}
              </Text>
              {isLinked && unlinkDisabled ? (
                <Text className="text-xs text-muted-foreground">
                  Must keep at least one sign-in method.
                </Text>
              ) : null}
            </View>
          </GroupedRow>
        );
      })}
    </GroupedSection>
  );
}
