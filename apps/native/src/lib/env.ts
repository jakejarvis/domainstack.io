import Constants from "expo-constants";

type ExpoExtra = {
  apiBaseUrl?: string;
  googleIosClientId?: string;
  googleWebClientId?: string;
  posthogKey?: string;
  posthogHost?: string;
  revenueCatIosKey?: string;
  revenueCatAndroidKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

function clean(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.startsWith("${")) return fallback;
  return trimmed.replace(/\/$/, "");
}

const rawApiBaseUrl = clean(process.env.EXPO_PUBLIC_DOMAINSTACK_API_URL ?? extra.apiBaseUrl, "");

if (!rawApiBaseUrl && !__DEV__) {
  // Production builds must point at a real backend — silently falling back to
  // localhost would leak requests to nothing and mask EAS env misconfiguration.
  throw new Error(
    "EXPO_PUBLIC_DOMAINSTACK_API_URL is required in production builds. Set it in the EAS build profile env.",
  );
}

export const apiBaseUrl = rawApiBaseUrl || "http://localhost:3000";

export const googleNativeConfig = {
  iosClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? extra.googleIosClientId, ""),
  webClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? extra.googleWebClientId, ""),
};

export const posthogKey = clean(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? extra.posthogKey, "");

export const posthogHost = clean(
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? extra.posthogHost,
  "https://us.i.posthog.com",
);

export const revenueCatIosKey = clean(
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? extra.revenueCatIosKey,
  "",
);

export const revenueCatAndroidKey = clean(
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? extra.revenueCatAndroidKey,
  "",
);
