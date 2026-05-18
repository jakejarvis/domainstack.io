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
  // Nonce-less by design (verified safe, not an oversight): the better-auth
  // server configures Google with only clientId/clientSecret and sets no
  // `requireNonce`, so it does NOT reject a nonce-less Google ID token — sign-in
  // works in production. better-auth still fully verifies the token server-side
  // (signature, audience, issuer, expiry); only the extra replay/binding that
  // Apple's hashed-nonce path has is absent.
  //
  // TODO: thread a SHA256 nonce through once we move off the free tier of
  // @react-native-google-signin/google-signin — its `signIn` params don't
  // accept `nonce` in 16.x (it's a paid-tier feature).
  const [{ Platform }, { GoogleSignin, isCancelledResponse, isSuccessResponse }] =
    await Promise.all([
      import("react-native"),
      import("@react-native-google-signin/google-signin"),
    ]);
  const platform = Platform.OS;

  GoogleSignin.configure(buildGoogleSignInConfig(config, platform));

  if (platform === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await GoogleSignin.signIn();

  if (isSuccessResponse(response)) {
    if (!response.data.idToken) {
      throw new Error("Google did not return an identity token.");
    }
    return response.data.idToken;
  }

  // `null` ONLY for an explicit user cancellation (caller treats it as a silent
  // no-op). Any other non-success is a real failure and must surface, not dead-
  // tap — throw so the caller toasts it.
  if (isCancelledResponse(response)) {
    return null;
  }
  throw new Error("Google sign-in didn’t complete. Please try again.");
}
