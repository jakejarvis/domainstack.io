import type { GoogleNativeAuthConfig, NativeAuthPlatform } from "@/lib/auth-providers";

const GOOGLE_SIGN_IN_SCOPES = ["email", "profile"];

export type GoogleSignInConfig = {
  iosClientId?: string;
  scopes: string[];
  webClientId: string;
};

export function buildGoogleSignInConfig(
  config: GoogleNativeAuthConfig,
  platform: NativeAuthPlatform = "ios",
): GoogleSignInConfig {
  const googleConfig: GoogleSignInConfig = {
    scopes: GOOGLE_SIGN_IN_SCOPES,
    webClientId: config.webClientId,
  };

  if (platform === "ios" && config.iosClientId.length > 0) {
    googleConfig.iosClientId = config.iosClientId;
  }

  return googleConfig;
}

export async function getGoogleIdentityToken(
  config: GoogleNativeAuthConfig,
): Promise<string | null> {
  const [{ Platform }, { GoogleSignin, isSuccessResponse }] = await Promise.all([
    import("react-native"),
    import("@react-native-google-signin/google-signin"),
  ]);
  const platform = Platform.OS;

  GoogleSignin.configure(buildGoogleSignInConfig(config, platform));

  if (platform === "android") {
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
