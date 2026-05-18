import { useQuery } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { AuthIcon } from "@/components/auth-icon";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
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

const WEB_URL = "https://domainstack.io";

function openLegal(path: "terms" | "privacy") {
  void WebBrowser.openBrowserAsync(`${WEB_URL}/${path}`, {
    dismissButtonStyle: "close",
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}

function SignInHero() {
  return (
    <View className="items-center gap-3 pt-4 pb-2">
      <Image
        accessible={false}
        contentFit="cover"
        source={require("../../assets/icon.png")}
        style={{ borderRadius: 18, height: 76, width: 76 }}
      />
      <Text variant="title">Domainstack</Text>
      <Text variant="subhead" className="text-center text-muted-foreground">
        Track ownership, expiry, DNS, and certificate changes; get notified before anything breaks.
      </Text>
    </View>
  );
}

function LegalFooter() {
  return (
    <Text variant="footnote" className="text-center text-muted-foreground">
      By continuing you agree to our{" "}
      <Text variant="footnote" className="text-brand" onPress={() => openLegal("terms")}>
        Terms
      </Text>{" "}
      and{" "}
      <Text variant="footnote" className="text-brand" onPress={() => openLegal("privacy")}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}

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

export { ScreenErrorBoundary as ErrorBoundary } from "@/components/screen-error-boundary";

export default function SignInScreen() {
  // Optimistically true on iOS (isAvailableAsync is effectively always true on
  // iOS 13+). This avoids flashing a fake disabled "Continue with Apple"
  // placeholder before the native button mounts; the effect still corrects the
  // rare unavailable case.
  const [appleAuthAvailable, setAppleAuthAvailable] = useState<boolean>(Platform.OS === "ios");
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

  // A no-error result doesn't guarantee a session: the browser OAuth sheet can
  // resolve without error if dismissed, and a native token exchange can succeed
  // without the session landing. Confirm before navigating, and give feedback
  // instead of a dead tap if it didn't.
  const confirmSessionAndFinish = async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      toast.error({
        title: "Sign-in didn’t complete",
        message: "Please try again.",
      });
      return;
    }
    finishSignIn();
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
      await confirmSessionAndFinish();
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
      await confirmSessionAndFinish();
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
      await confirmSessionAndFinish();
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
      <SignInHero />
      <Card>
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
          <>
            <Text className="text-sm text-muted-foreground">
              No sign-in providers are available right now.
            </Text>
            <Button onPress={() => void otaConfig.refetch()} variant="secondary">
              <Text>Try again</Text>
            </Button>
          </>
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
      </Card>
      <LegalFooter />
    </Screen>
  );
}

function ProviderButton({
  appleAuthAvailable,
  loadingProvider,
  onPress,
  provider,
}: {
  appleAuthAvailable: boolean;
  loadingProvider: AuthProvider | null;
  onPress: (provider: NativeAuthProviderOption) => void;
  provider: NativeAuthProviderOption;
}) {
  const variant = isPlatformPreferredProvider(provider) ? "primary" : "secondary";
  const primaryColor = useCSSVariable("--color-primary-foreground") as string;
  const secondaryColor = useCSSVariable("--color-secondary-foreground") as string;
  const iconColor = variant === "primary" ? primaryColor : secondaryColor;

  if (provider.id === "apple" && appleAuthAvailable) {
    if (loadingProvider === "apple") {
      return (
        <Button disabled loading variant="primary">
          <AuthIcon color={primaryColor} provider="apple" size={18} />
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
      <AuthIcon color={iconColor} provider={provider.id} size={18} />
      <Text>Continue with {provider.name}</Text>
    </Button>
  );
}
