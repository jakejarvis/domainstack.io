import type { GoogleNativeAuthConfig } from "@/lib/auth-providers";

const GOOGLE_SIGN_IN_SCOPES = ["email", "profile"];

export type GoogleSignInConfig = {
  iosClientId: string | undefined;
  scopes: string[];
  webClientId: string;
};

export function buildGoogleSignInConfig(config: GoogleNativeAuthConfig): GoogleSignInConfig {
  return {
    iosClientId: config.iosClientId || undefined,
    scopes: GOOGLE_SIGN_IN_SCOPES,
    webClientId: config.webClientId,
  };
}

export async function getGoogleIdentityToken(
  config: GoogleNativeAuthConfig,
): Promise<string | null> {
  const [{ Platform }, { GoogleSignin, isSuccessResponse }] = await Promise.all([
    import("react-native"),
    import("@react-native-google-signin/google-signin"),
  ]);

  GoogleSignin.configure(buildGoogleSignInConfig(config));

  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    return null;
  }

  if (!response.data.idToken) {
    throw new Error("Google did not return an identity token.");
  }

  return response.data.idToken;
}
