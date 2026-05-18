import { expo } from "@better-auth/expo";
import { dash } from "@better-auth/infra";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getSessionCookie } from "better-auth/cookies";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";

import { sendStoreSubscriptionCancelReminderEmail } from "@domainstack/billing/emails";
import {
  getProductsForCheckout,
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
  handleSubscriptionUncanceled,
} from "@domainstack/billing/polar";
import { checkout, polar, portal, webhooks } from "@domainstack/billing/polar/better-auth/server";
import { polarClient } from "@domainstack/billing/polar/server";
import {
  deleteRevenueCatSubscriber,
  getRevenueCatCustomerState,
} from "@domainstack/billing/revenuecat";
import { db } from "@domainstack/db/client";
import { createSubscription } from "@domainstack/db/queries";
import * as schema from "@domainstack/db/schema";
import { addContact, removeContact, sendEmail } from "@domainstack/email";
import DeleteAccountVerifyEmail from "@domainstack/email/templates/delete-account-verify";
import { createLogger } from "@domainstack/logger";
import { getRedis } from "@domainstack/redis";
import { getNativeAppConfig } from "@domainstack/server/edge-config";

import { AppleClientSecret, decodeApplePrivateKey } from "./apple-client-secret";
import { otaConfig } from "./ota-config";
import { buildOAuthProviders, validateOAuthCredentialPair } from "./providers";
import { createRedisStorage } from "./storage";
import type { OAuthCredentials } from "./types";

const logger = createLogger({ source: "auth" });

// Better Auth's secondary storage (sessions + its own rate-limit buckets)
// stores opaque JSON strings; disable auto-deserialization so they round-trip
// verbatim instead of being parsed and re-stringified.
const redis = getRedis({ automaticDeserialization: false });

// Validate required env vars
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required");
}

// Polar is optional, but webhook secret is required if Polar is enabled
if (process.env.POLAR_ACCESS_TOKEN && !process.env.POLAR_WEBHOOK_SECRET) {
  throw new Error("POLAR_WEBHOOK_SECRET is required when POLAR_ACCESS_TOKEN is set");
}

// Validate OAuth credential pairs
validateOAuthCredentialPair(
  "GITHUB",
  process.env.GITHUB_CLIENT_ID,
  process.env.GITHUB_CLIENT_SECRET,
);
validateOAuthCredentialPair(
  "GITLAB",
  process.env.GITLAB_CLIENT_ID,
  process.env.GITLAB_CLIENT_SECRET,
);
validateOAuthCredentialPair(
  "GOOGLE",
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);
validateOAuthCredentialPair(
  "VERCEL",
  process.env.VERCEL_CLIENT_ID,
  process.env.VERCEL_CLIENT_SECRET,
);
// Apple's "client secret" is a short-lived JWT signed with the .p8 key. It is
// re-signed lazily before expiry (see AppleClientSecret) so it never needs
// manual rotation regardless of process lifetime.
async function buildAppleCredentials(): Promise<OAuthCredentials | undefined> {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) return undefined;

  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKeyBase64 = process.env.APPLE_PRIVATE_KEY_BASE64;
  const appBundleIdentifier = process.env.APPLE_APP_BUNDLE_IDENTIFIER;

  if (!teamId || !keyId || !privateKeyBase64 || !appBundleIdentifier) {
    throw new Error(
      "Apple sign-in requires APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY_BASE64, and APPLE_APP_BUNDLE_IDENTIFIER when APPLE_CLIENT_ID is set",
    );
  }

  const secret = await AppleClientSecret.create({
    teamId,
    keyId,
    clientId,
    privateKey: decodeApplePrivateKey(privateKeyBase64),
  });

  // `clientSecret` is a live getter: Better Auth reads it on every Apple
  // authorization-code exchange, so it always sees a non-expired JWT. Do NOT
  // spread this object — `{ ...creds }` would freeze the getter into a stale
  // snapshot. buildOAuthProviders assigns by reference, which preserves it.
  const credentials = { clientId, appBundleIdentifier } as OAuthCredentials;
  Object.defineProperty(credentials, "clientSecret", {
    get: () => secret.current(),
    enumerable: true,
  });
  return credentials;
}

const appleCredentials = await buildAppleCredentials();

// Build OAuth providers from env vars
const { providers: socialProviders, enabledProviders } = buildOAuthProviders({
  apple: appleCredentials,
  github:
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        }
      : undefined,
  gitlab:
    process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET
      ? {
          clientId: process.env.GITLAB_CLIENT_ID,
          clientSecret: process.env.GITLAB_CLIENT_SECRET,
        }
      : undefined,
  google:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }
      : undefined,
  vercel:
    process.env.VERCEL_CLIENT_ID && process.env.VERCEL_CLIENT_SECRET
      ? {
          clientId: process.env.VERCEL_CLIENT_ID,
          clientSecret: process.env.VERCEL_CLIENT_SECRET,
        }
      : undefined,
});

// Ensure at least one OAuth provider is configured
if (enabledProviders.length === 0) {
  throw new Error(
    "At least one OAuth provider must be configured (Apple, GitHub, GitLab, Google, or Vercel)",
  );
}

const trustedOrigins = [
  process.env.NEXT_PUBLIC_BASE_URL,
  "https://appleid.apple.com",
  "domainstack://",
  // Expo dev clients deep-link via exp:// on a LAN IP (exp://192.168.x.x:8081);
  // a bare "exp://" prefix matches any of them since non-http origins are
  // compared with startsWith. Mirrors the Expo plugin's own dev injection.
  ...(process.env.NODE_ENV !== "production" ? ["exp://"] : []),
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  appName: "Domainstack",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  secondaryStorage: createRedisStorage(redis ?? null),
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  logger: {
    log: (level, message, ...args) => {
      const logFn = logger[level].bind(logger);
      logFn({ ...args }, message);
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create free tier subscription for new users
          await createSubscription(user.id);

          // Create Resend contact for marketing communications
          void addContact(user.email, user.name);
        },
      },
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        // Cancel Polar subscription if user has one
        // This deletes the Polar customer, which automatically cancels any active
        // subscriptions and revokes benefits
        if (polarClient) {
          try {
            await polarClient.customers.deleteExternal({
              externalId: user.id,
            });
          } catch (err) {
            // Don't block account deletion if Polar cleanup fails
            logger.error({ err, userId: user.id }, "failed to delete Polar customer");
          }
        }

        // RevenueCat has no server-side cancel: deleting the subscriber only
        // stops our tracking — an active App Store / Play subscription keeps
        // billing until the user cancels it themselves in the store. Flag that
        // case for support follow-up; never block account deletion.
        if (process.env.REVENUECAT_API_KEY) {
          try {
            const state = await getRevenueCatCustomerState(user.id);
            if (state.status === "ok" && state.hasActiveSubscription) {
              logger.warn(
                { userId: user.id },
                "Account deleted with an active RevenueCat store subscription that must be cancelled in-store by the user",
              );
              // The store keeps billing until the user cancels it themselves —
              // tell them how. Best-effort: a mail failure must not block
              // deletion or the RevenueCat cleanup below.
              try {
                await sendStoreSubscriptionCancelReminderEmail(user.id);
              } catch (err) {
                logger.error(
                  { err, userId: user.id },
                  "failed to send store-subscription cancel reminder email",
                );
              }
            }
            await deleteRevenueCatSubscriber(user.id);
          } catch (err) {
            logger.error({ err, userId: user.id }, "failed to delete RevenueCat subscriber");
          }
        }

        // Delete Resend contact
        void removeContact(user.email);
      },
      sendDeleteAccountVerification: async ({ user, url }) => {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL as string;
        void sendEmail(
          {
            to: user.email,
            subject: "Confirm your account deletion",
            react: DeleteAccountVerifyEmail({
              userName: user.name,
              confirmUrl: url,
              baseUrl,
            }),
          },
          { baseUrl },
        );
      },
    },
  },
  socialProviders,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    storeSessionInDatabase: true,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
      // encrypt cookie payload so session data is not readable if intercepted:
      strategy: "jwe",
    },
  },
  verification: {
    storeInDatabase: true,
  },
  rateLimit: {
    storage: redis ? "secondary-storage" : "memory",
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: enabledProviders,
      allowUnlinkingAll: false,
    },
  },
  experimental: {
    joins: true,
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-vercel-forwarded-for"],
    },
  },
  plugins: [
    ...(polarClient
      ? [
          polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
              checkout({
                products: getProductsForCheckout(),
                successUrl: process.env.POLAR_SUCCESS_URL || "/dashboard?upgraded=true",
                authenticatedUsersOnly: true,
                theme: "dark",
              }),
              portal(),
              webhooks({
                secret: process.env.POLAR_WEBHOOK_SECRET!,
                onSubscriptionCreated: handleSubscriptionCreated,
                onSubscriptionActive: handleSubscriptionActive,
                onSubscriptionCanceled: handleSubscriptionCanceled,
                onSubscriptionRevoked: handleSubscriptionRevoked,
                onSubscriptionUncanceled: handleSubscriptionUncanceled,
              }),
            ],
          }),
        ]
      : []),
    dash(),
    otaConfig({ enabledProviders, getNativeApp: getNativeAppConfig }),
    expo(),
    // must be last: https://www.better-auth.com/docs/integrations/next#server-action-cookies
    nextCookies(),
  ],
} as BetterAuthOptions);

export type Session = typeof auth.$Infer.Session;

// Re-export Next.js utilities for consumers
export { getSessionCookie, toNextJsHandler };
