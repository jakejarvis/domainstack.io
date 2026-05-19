import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { AuthIcon } from "@/components/auth-icon";
import { Button } from "@/components/button";
import { GroupedRow, GroupedSection } from "@/components/form/group";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import {
  type AuthProvider,
  linkProvider,
  linkProviderWithAppleToken,
  linkProviderWithGoogleToken,
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
  const { t } = useLingui();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const iconColor = useCSSVariable("--color-foreground") as string;
  const [appleAuthAvailable, setAppleAuthAvailable] = useState<boolean | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<AuthProvider | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<AuthProvider | null>(null);

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
  }, []);

  const oauthProviders = useQuery({
    ...trpc.auth.getOauthProviders.queryOptions(),
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

  const providerOptions = oauthProviders.data
    ? getEnabledNativeAuthProviders(oauthProviders.data, googleNativeConfig, {
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
      toast.success(t`Account linked`);
    } catch (error) {
      if (!isAuthCanceled(error)) {
        analytics.trackException(error, { action: "link_account", provider: provider.id });
        toast.error({
          title: t`Could not link account`,
          message: error instanceof Error ? error.message : t`Unable to link this provider.`,
        });
      }
    } finally {
      setLinkingProvider(null);
    }
  }

  async function handleUnlink(provider: AuthProvider) {
    const accepted = await confirm({
      confirmLabel: t`Unlink`,
      destructive: true,
      message: t`You won’t be able to sign in with ${provider} again until you re-link it.`,
      title: t`Unlink ${provider}?`,
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
      const message = error instanceof Error ? error.message : t`Unable to unlink this provider.`;
      toast.error({ title: t`Could not unlink account`, message });
    } finally {
      setUnlinkingProvider(null);
    }
  }

  if (oauthProviders.isPending || linkedAccounts.isPending) {
    return (
      <GroupedSection title={t`Sign-in methods`}>
        <View className="p-3">
          <Text className="text-sm text-muted-foreground">
            <Trans>Loading providers…</Trans>
          </Text>
        </View>
      </GroupedSection>
    );
  }

  if (oauthProviders.isError) {
    return (
      <GroupedSection title={t`Sign-in methods`}>
        <View className="gap-3 p-3">
          <Text className="text-sm text-muted-foreground">
            <Trans>Couldn’t load your sign-in methods. Check your connection and try again.</Trans>
          </Text>
          <Button
            loading={oauthProviders.isFetching}
            onPress={() => void oauthProviders.refetch()}
            variant="secondary"
          >
            <Text>
              <Trans>Try again</Trans>
            </Text>
          </Button>
        </View>
      </GroupedSection>
    );
  }

  if (providerOptions.length === 0) {
    return (
      <GroupedSection title={t`Sign-in methods`}>
        <View className="p-3">
          <Text className="text-sm text-muted-foreground">
            <Trans>No sign-in providers are available right now.</Trans>
          </Text>
        </View>
      </GroupedSection>
    );
  }

  return (
    <GroupedSection
      footer={t`Add a second sign-in method so you can recover access even if one provider is unavailable.`}
      title={t`Sign-in methods`}
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
                  <Text>
                    <Trans>Unlink</Trans>
                  </Text>
                </Button>
              ) : (
                <Button
                  loading={linkingProvider === provider.id}
                  onPress={() => void handleLink(provider)}
                  variant="primary"
                >
                  <Text>
                    <Trans>Link</Trans>
                  </Text>
                </Button>
              )
            }
          >
            <AuthIcon color={iconColor} provider={provider.id} size={22} />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="font-semibold" numberOfLines={1}>
                {provider.name}
              </Text>
              {isLinked && unlinkDisabled ? (
                <Text className="text-xs text-muted-foreground">
                  <Trans>Must keep at least one sign-in method.</Trans>
                </Text>
              ) : null}
            </View>
          </GroupedRow>
        );
      })}
    </GroupedSection>
  );
}
