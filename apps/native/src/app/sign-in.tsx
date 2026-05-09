import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { MutedText, Text } from "@/components/text";
import { type AuthProvider, signInWithAppleToken, signInWithProvider } from "@/lib/auth";
import { getInitialRoute } from "@/lib/navigation";

const providers: Array<{ label: string; provider: AuthProvider }> = [
  { label: "Continue with Google", provider: "google" },
  { label: "Continue with GitHub", provider: "github" },
];

function isAuthCanceled(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_REQUEST_CANCELED";
}

export default function SignInScreen() {
  const [appleAuthAvailable, setAppleAuthAvailable] = useState<boolean | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);

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
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token.");
      }

      const result = await signInWithAppleToken(credential.identityToken);
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

  return (
    <Screen>
      <View className="gap-2">
        <Text className="text-4xl font-semibold">Domainstack</Text>
        <MutedText>Sign in to manage tracked domains, verification, and alerts.</MutedText>
      </View>

      <GlassCard>
        {appleAuthAvailable === null ? (
          <Button disabled loading variant="primary">
            Continue with Apple
          </Button>
        ) : appleAuthAvailable ? (
          <View
            className={loadingProvider !== null ? "opacity-55" : undefined}
            pointerEvents={loadingProvider !== null ? "none" : "auto"}
          >
            <AppleAuthentication.AppleAuthenticationButton
              accessibilityLabel="Continue with Apple"
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              cornerRadius={12}
              onPress={() => {
                void handleNativeAppleSignIn();
              }}
              style={{ height: 48, width: "100%" }}
            />
          </View>
        ) : (
          <Button
            disabled={loadingProvider !== null}
            loading={loadingProvider === "apple"}
            onPress={() => {
              void handleProviderSignIn("apple");
            }}
            variant="primary"
          >
            Continue with Apple
          </Button>
        )}
        {providers.map((item) => (
          <Button
            key={item.provider}
            disabled={loadingProvider !== null}
            loading={loadingProvider === item.provider}
            onPress={() => {
              void handleProviderSignIn(item.provider);
            }}
            variant="secondary"
          >
            {item.label}
          </Button>
        ))}
      </GlassCard>
    </Screen>
  );
}
