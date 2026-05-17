import { useQuery } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { ProviderIcon } from "@/components/provider-icon";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { usePushSoftPrompt } from "@/hooks/use-push-soft-prompt";
import { analytics } from "@/lib/analytics";
import {
  type AuthProvider,
  authClient,
  getOtaConfig,
  OTA_CONFIG_QUERY_KEY,
  signInWithAppleToken,
  signInWithGoogleToken,
  signInWithProvider,
} from "@/lib/auth";
import { getEnabledNativeAuthProviders, type NativeAuthProviderOption } from "@/lib/auth-providers";
import { googleNativeConfig } from "@/lib/env";
import { getGoogleIdentityToken } from "@/lib/google-auth";
import { getInitialRoute } from "@/lib/navigation";
import { createAuthNonce } from "@/lib/nonce";
import { toast } from "@/lib/toast";

function isAuthCanceled(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_REQUEST_CANCELED";
}

function isPlatformPreferredProvider(provider: NativeAuthProviderOption): boolean {
  if (provider.id === "apple" && Platform.OS === "ios") return true;
  if (provider.id === "google" && Platform.OS === "android" && provider.supportsNativeIdToken) {
    return true;
  }
  return false;
}

function isProviderAvailableOnPlatform(provider: NativeAuthProviderOption): boolean {
  // Apple sign-in is iOS-only; hide it elsewhere.
  if (provider.id === "apple" && Platform.OS !== "ios") return false;
  return true;
}

export default function SignInScreen() {
  const [appleAuthAvailable, setAppleAuthAvailable] = useState<boolean | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);
  const triggerPushPrompt = usePushSoftPrompt();
  const otaConfig = useQuery({
    queryFn: getOtaConfig,
    queryKey: OTA_CONFIG_QUERY_KEY,
    staleTime: 1000 * 60 * 5,
  });

  const providerOptions = otaConfig.data
    ? getEnabledNativeAuthProviders(otaConfig.data.authProviders, googleNativeConfig, {
        appleAuthAvailable: appleAuthAvailable === true,
        platform: Platform.OS,
      })
        .filter(isProviderAvailableOnPlatform)
        // `.filter()` returns a fresh array, so sorting it in place is safe.
        // (Hermes in RN 0.85 doesn't implement `Array.prototype.toSorted`.)
        .sort(
          (a, b) => Number(isPlatformPreferredProvider(b)) - Number(isPlatformPreferredProvider(a)),
        )
    : [];

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
  }, []);

  const finishSignIn = () => {
    void triggerPushPrompt("signIn");
    router.replace(getInitialRoute(true));
  };

  const showSignInError = (provider: string, error: unknown) => {
    if (isAuthCanceled(error)) return;

    toast.error({
      title: "Sign in failed",
      message:
        error instanceof Error
          ? error.message
          : `Unable to sign in with ${provider}. Please try again.`,
    });
  };

  const handleProviderSignIn = async (provider: AuthProvider) => {
    analytics.track("sign_in_clicked", { provider });
    setLoadingProvider(provider);

    try {
      const result = await signInWithProvider(provider);
      if (result.error) {
        throw new Error(result.error.message ?? `Unable to sign in with ${provider}.`);
      }
      // The browser OAuth flow resolves without an error even when the user
      // dismisses the auth sheet, so confirm the session cookie actually
      // landed before navigating away from the sign-in screen.
      const session = await authClient.getSession();
      if (!session.data?.user) return;
      finishSignIn();
    } catch (error) {
      showSignInError(provider, error);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleNativeAppleSignIn = async () => {
    analytics.track("sign_in_clicked", { provider: "apple" });
    setLoadingProvider("apple");

    try {
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

      const result = await signInWithAppleToken(credential.identityToken, nonce);
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to sign in with Apple.");
      }
      finishSignIn();
    } catch (error) {
      showSignInError("Apple", error);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleNativeGoogleSignIn = async () => {
    analytics.track("sign_in_clicked", { provider: "google" });
    setLoadingProvider("google");

    try {
      const token = await getGoogleIdentityToken(googleNativeConfig);
      if (!token) return;

      const result = await signInWithGoogleToken(token);
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to sign in with Google.");
      }
      finishSignIn();
    } catch (error) {
      showSignInError("Google", error);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleSignIn = (provider: NativeAuthProviderOption) => {
    if (loadingProvider !== null) return;

    if (provider.id === "apple" && appleAuthAvailable) {
      void handleNativeAppleSignIn();
      return;
    }

    if (provider.id === "google" && provider.supportsNativeIdToken) {
      void handleNativeGoogleSignIn();
      return;
    }

    void handleProviderSignIn(provider.id);
  };

  return (
    <Screen>
      <GlassCard>
        {otaConfig.isPending ? (
          <Button disabled loading variant="primary">
            <Text>Loading sign-in options…</Text>
          </Button>
        ) : otaConfig.isError ? (
          <>
            <Text className="text-sm text-muted-foreground">Sign-in options are unavailable.</Text>
            <Button onPress={() => void otaConfig.refetch()} variant="secondary">
              <Text>Try again</Text>
            </Button>
          </>
        ) : providerOptions.length === 0 ? (
          <Text className="text-sm text-muted-foreground">
            No sign-in providers are available right now.
          </Text>
        ) : (
          providerOptions.map((provider) => (
            <ProviderButton
              key={provider.id}
              appleAuthAvailable={appleAuthAvailable}
              loadingProvider={loadingProvider}
              onPress={handleSignIn}
              provider={provider}
            />
          ))
        )}
      </GlassCard>
    </Screen>
  );
}

function ProviderButton({
  appleAuthAvailable,
  loadingProvider,
  onPress,
  provider,
}: {
  appleAuthAvailable: boolean | null;
  loadingProvider: AuthProvider | null;
  onPress: (provider: NativeAuthProviderOption) => void;
  provider: NativeAuthProviderOption;
}) {
  const variant = isPlatformPreferredProvider(provider) ? "primary" : "secondary";
  const primaryColor = useCSSVariable("--color-primary-foreground") as string;
  const secondaryColor = useCSSVariable("--color-secondary-foreground") as string;
  const iconColor = variant === "primary" ? primaryColor : secondaryColor;

  if (provider.id === "apple" && appleAuthAvailable === null) {
    return (
      <Button disabled loading variant="primary">
        <ProviderIcon color={primaryColor} provider="apple" size={18} />
        <Text>Continue with Apple</Text>
      </Button>
    );
  }

  if (provider.id === "apple" && appleAuthAvailable) {
    if (loadingProvider === "apple") {
      return (
        <Button disabled loading variant="primary">
          <ProviderIcon color={primaryColor} provider="apple" size={18} />
          <Text>Continue with Apple</Text>
        </Button>
      );
    }
    if (loadingProvider !== null) return null;
    return (
      <AppleAuthentication.AppleAuthenticationButton
        accessibilityLabel="Continue with Apple"
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        cornerRadius={12}
        onPress={() => onPress(provider)}
        style={{ height: 48, width: "100%" }}
      />
    );
  }

  return (
    <Button
      disabled={loadingProvider !== null}
      loading={loadingProvider === provider.id}
      onPress={() => onPress(provider)}
      variant={variant}
    >
      <ProviderIcon color={iconColor} provider={provider.id} size={18} />
      <Text>Continue with {provider.name}</Text>
    </Button>
  );
}
