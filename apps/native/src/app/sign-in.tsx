import { useQuery } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, View } from "react-native";

import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { MutedText, Text } from "@/components/text";
import {
  type AuthProvider,
  getOtaConfig,
  signInWithAppleToken,
  signInWithGoogleToken,
  signInWithProvider,
} from "@/lib/auth";
import { getEnabledNativeAuthProviders, type NativeAuthProviderOption } from "@/lib/auth-providers";
import { googleNativeConfig } from "@/lib/env";
import { getGoogleIdentityToken } from "@/lib/google-auth";
import { getInitialRoute } from "@/lib/navigation";
import { createAuthNonce } from "@/lib/nonce";

const OTA_CONFIG_QUERY_KEY = ["auth", "ota-config"] as const;

function isAuthCanceled(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_REQUEST_CANCELED";
}

export default function SignInScreen() {
  const [appleAuthAvailable, setAppleAuthAvailable] = useState<boolean | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);
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
    : [];

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
  }, []);

  const finishSignIn = () => {
    router.replace(getInitialRoute(true));
  };

  const showSignInError = (provider: string, error: unknown) => {
    if (isAuthCanceled(error)) return;

    Alert.alert(
      "Sign in failed",
      error instanceof Error
        ? error.message
        : `Unable to sign in with ${provider}. Please try again.`,
    );
  };

  const handleProviderSignIn = async (provider: AuthProvider) => {
    setLoadingProvider(provider);

    try {
      const result = await signInWithProvider(provider);
      if (result.error) {
        throw new Error(result.error.message ?? `Unable to sign in with ${provider}.`);
      }
      finishSignIn();
    } catch (error) {
      showSignInError(provider, error);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleNativeAppleSignIn = async () => {
    setLoadingProvider("apple");

    try {
      const nonce = await createAuthNonce();
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

  const renderProviderButton = (provider: NativeAuthProviderOption) => {
    if (provider.id === "apple" && appleAuthAvailable === null) {
      return (
        <Button key={provider.id} disabled loading variant="primary">
          Continue with Apple
        </Button>
      );
    }

    if (provider.id === "apple" && appleAuthAvailable) {
      return (
        <View
          key={provider.id}
          className={loadingProvider !== null ? "opacity-55" : undefined}
          pointerEvents={loadingProvider !== null ? "none" : "auto"}
        >
          <AppleAuthentication.AppleAuthenticationButton
            accessibilityLabel="Continue with Apple"
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            cornerRadius={12}
            onPress={() => handleSignIn(provider)}
            style={{ height: 48, width: "100%" }}
          />
        </View>
      );
    }

    return (
      <Button
        key={provider.id}
        disabled={loadingProvider !== null}
        loading={loadingProvider === provider.id}
        onPress={() => handleSignIn(provider)}
        variant={provider.supportsNativeIdToken ? "primary" : "secondary"}
      >
        Continue with {provider.name}
      </Button>
    );
  };

  const renderProviderContent = () => {
    if (otaConfig.isPending) {
      return (
        <Button disabled loading variant="primary">
          Loading sign-in options…
        </Button>
      );
    }

    if (otaConfig.isError) {
      return (
        <>
          <MutedText>Sign-in options are unavailable.</MutedText>
          <Button onPress={() => void otaConfig.refetch()} variant="secondary">
            Try again
          </Button>
        </>
      );
    }

    if (providerOptions.length === 0) {
      return <MutedText>No sign-in providers are available right now.</MutedText>;
    }

    return providerOptions.map(renderProviderButton);
  };

  return (
    <Screen>
      <View className="gap-2">
        <Text className="text-4xl font-semibold">Domainstack</Text>
        <MutedText>Sign in to manage tracked domains, verification, and notifications.</MutedText>
      </View>

      <GlassCard>{renderProviderContent()}</GlassCard>
    </Screen>
  );
}
