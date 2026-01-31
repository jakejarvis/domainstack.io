import { db } from "@domainstack/db/client";
import { createSubscription } from "@domainstack/db/queries";
import * as schema from "@domainstack/db/schema";
import { addContact, removeContact, sendEmail } from "@domainstack/email";
import DeleteAccountVerifyEmail from "@domainstack/email/templates/delete-account-verify";
import { createLogger } from "@domainstack/logger";
import {
  getProductsForCheckout,
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
  handleSubscriptionUncanceled,
} from "@domainstack/polar";
import {
  checkout,
  polar,
  portal,
  webhooks,
} from "@domainstack/polar/better-auth/server";
import { Polar } from "@domainstack/polar/sdk";
import { getRedis } from "@domainstack/redis";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getSessionCookie } from "better-auth/cookies";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import {
  ACCOUNT_LINKING_CONFIG,
  buildOAuthProviders,
  createRedisStorage,
  SESSION_CONFIG,
  validateOAuthCredentialPair,
} from "./index";

const logger = createLogger({ source: "auth" });

const redis = getRedis();

// Validate required env vars
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required");
}

// Polar is optional, but webhook secret is required if Polar is enabled
if (process.env.POLAR_ACCESS_TOKEN && !process.env.POLAR_WEBHOOK_SECRET) {
  throw new Error(
    "POLAR_WEBHOOK_SECRET is required when POLAR_ACCESS_TOKEN is set",
  );
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

// Build OAuth providers from env vars
const { providers: socialProviders, enabledProviders } = buildOAuthProviders({
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
    "At least one OAuth provider must be configured (GitHub, GitLab, Google, or Vercel)",
  );
}

// Use VERCEL_ENV to determine Polar environment (not NODE_ENV, which is "production" on preview deployments too)
// This prevents preview deployments from hitting the production Polar API
const polarClient = process.env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server:
        process.env.VERCEL_ENV === "production" ? "production" : "sandbox",
    })
  : null;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  secondaryStorage: createRedisStorage(redis ?? null),
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
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
            logger.error(
              { err, userId: user.id },
              "failed to delete Polar customer",
            );
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
  session: SESSION_CONFIG,
  rateLimit: {
    storage: redis ? "secondary-storage" : "memory",
  },
  account: {
    accountLinking: {
      ...ACCOUNT_LINKING_CONFIG,
      trustedProviders: enabledProviders,
    },
  },
  experimental: {
    joins: true,
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
                successUrl:
                  process.env.POLAR_SUCCESS_URL || "/dashboard?upgraded=true",
                authenticatedUsersOnly: true,
                theme: "dark",
              }),
              portal(),
              webhooks({
                // biome-ignore lint/style/noNonNullAssertion: webhook secret is validated above
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
    // must be last: https://www.better-auth.com/docs/integrations/next#server-action-cookies
    nextCookies(),
  ],
} satisfies BetterAuthOptions);

export type Session = typeof auth.$Infer.Session;

// Re-export Next.js utilities for consumers
export { toNextJsHandler, getSessionCookie };
