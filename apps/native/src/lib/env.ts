import Constants from "expo-constants";

type ExpoExtra = {
  apiBaseUrl?: string;
  appleOauthEnabled?: string;
  githubOauthEnabled?: string;
  gitlabOauthEnabled?: string;
  googleIosClientId?: string;
  googleOauthEnabled?: string;
  googleWebClientId?: string;
  posthogKey?: string;
  posthogHost?: string;
  vercelOauthEnabled?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

function clean(value: string | undefined, fallback: string): string {
  if (!value || value.startsWith("${")) return fallback;
  return value.replace(/\/$/, "");
}

function flag(value: string | undefined): boolean {
  return value === "true";
}

export const apiBaseUrl = clean(
  process.env.EXPO_PUBLIC_DOMAINSTACK_API_URL ?? extra.apiBaseUrl,
  "http://localhost:3000",
);

export const googleNativeConfig = {
  iosClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? extra.googleIosClientId, ""),
  webClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? extra.googleWebClientId, ""),
};

export const nativeOAuthEnabled = {
  apple: flag(process.env.EXPO_PUBLIC_APPLE_OAUTH_ENABLED ?? extra.appleOauthEnabled),
  github: flag(process.env.EXPO_PUBLIC_GITHUB_OAUTH_ENABLED ?? extra.githubOauthEnabled),
  gitlab: flag(process.env.EXPO_PUBLIC_GITLAB_OAUTH_ENABLED ?? extra.gitlabOauthEnabled),
  google: flag(process.env.EXPO_PUBLIC_GOOGLE_OAUTH_ENABLED ?? extra.googleOauthEnabled),
  vercel: flag(process.env.EXPO_PUBLIC_VERCEL_OAUTH_ENABLED ?? extra.vercelOauthEnabled),
};

export const posthogKey = clean(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? extra.posthogKey, "");

export const posthogHost = clean(
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? extra.posthogHost,
  "https://us.i.posthog.com",
);
