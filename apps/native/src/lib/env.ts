import Constants from "expo-constants";

type ExpoExtra = {
  apiBaseUrl?: string;
  posthogKey?: string;
  posthogHost?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

function clean(value: string | undefined, fallback: string): string {
  if (!value || value.startsWith("${")) return fallback;
  return value.replace(/\/$/, "");
}

export const apiBaseUrl = clean(
  process.env.EXPO_PUBLIC_DOMAINSTACK_API_URL ?? extra.apiBaseUrl,
  "http://localhost:3000",
);

export const posthogKey = clean(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? extra.posthogKey, "");

export const posthogHost = clean(
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? extra.posthogHost,
  "https://us.i.posthog.com",
);
