import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { dash } from "@better-auth/infra";
import { waitUntil } from "@vercel/functions";
import { getSessionCookie } from "better-auth/cookies";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";

import { db } from "@domainstack/db/client";
import { createSubscription } from "@domainstack/db/queries";
import * as schema from "@domainstack/db/schema";
import { addContact, removeContact, sendEmail } from "@domainstack/email";
import DeleteAccountVerifyEmail from "@domainstack/email/templates/delete-account-verify";
import { createLogger } from "@domainstack/logger";
import {
  getProductsForCheckout,
  handleOrderPaid,
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
  handleSubscriptionUncanceled,
} from "@domainstack/polar";
import { checkout, polar, portal, webhooks } from "@domainstack/polar/better-auth/server";
import { polarClient } from "@domainstack/polar/server";
import { getRedis } from "@domainstack/redis";

import { analytics } from "./analytics";
import { buildOAuthProviders, validateOAuthCredentialPair } from "./providers";
import { createRedisStorage } from "./storage";

const logger = createLogger({ source: "auth" });

const redis = getRedis();

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
          // Create free tier subscription for new users (do not defer)
          await createSubscription(user.id);

          // Create Resend contact for marketing communications
          waitUntil(addContact(user.email, user.name));

          analytics.track(
            "signed_up",
            {
              $set: { email: user.email, name: user.name },
              $set_once: {
                createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
              },
            },
            user.id,
          );
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
        try {
          await polarClient?.customers.deleteExternal({
            externalId: user.id,
          });
        } catch (err) {
          // Don't block account deletion if Polar cleanup fails
          logger.error({ err, userId: user.id }, "failed to delete Polar customer");
        }

        // Delete Resend contact
        waitUntil(removeContact(user.email));
      },
      sendDeleteAccountVerification: async ({ user, url }) => {
        waitUntil(
          sendEmail(
            {
              to: user.email,
              subject: "Confirm your account deletion",
              react: DeleteAccountVerifyEmail({
                userName: user.name,
                confirmUrl: url,
                baseUrl: process.env.NEXT_PUBLIC_BASE_URL as string,
              }),
            },
            { baseUrl: process.env.NEXT_PUBLIC_BASE_URL as string },
          ),
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
    },
  },
  advanced: {
    database: {
      joins: true,
    },
    backgroundTasks: {
      handler: waitUntil,
    },
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
                onOrderPaid: handleOrderPaid,
              }),
            ],
          }),
        ]
      : []),
    dash({
      apiKey: process.env.BETTER_AUTH_API_KEY,
    }),
    // must be last: https://www.better-auth.com/docs/integrations/next#server-action-cookies
    nextCookies(),
  ],
} as BetterAuthOptions);

export type Session = typeof auth.$Infer.Session;

// Re-export Next.js utilities for consumers
export { getSessionCookie, toNextJsHandler };
