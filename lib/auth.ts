import "server-only";

import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { DeleteAccountVerifyEmail } from "@/emails/delete-account-verify";
import { analytics } from "@/lib/analytics/server";
import { BASE_URL } from "@/lib/constants";
import { getEnabledProviders } from "@/lib/constants/oauth-providers";
import { db } from "@/lib/db/client";
import { createSubscription } from "@/lib/db/repos/user-subscription";
import * as schema from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";
import {
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
} from "@/lib/polar/handlers";
import { getProductsForCheckout } from "@/lib/polar/products";
import { RESEND_FROM_EMAIL, resend } from "@/lib/resend";

const logger = createLogger({ source: "auth" });

// Validate required env vars
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required");
}
if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  throw new Error("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required");
}
// Polar is optional, but webhook secret is required if Polar is enabled
if (process.env.POLAR_ACCESS_TOKEN && !process.env.POLAR_WEBHOOK_SECRET) {
  throw new Error(
    "POLAR_WEBHOOK_SECRET is required when POLAR_ACCESS_TOKEN is set",
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
  baseURL: BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  logger: {
    log: (level, message, ...args) =>
      logger.log(level, message, args.length > 0 ? { args } : undefined),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create free tier subscription for new users
          await createSubscription(user.id);
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          // Track signup with the actual OAuth provider used
          // This fires after user.create, so we have accurate provider info
          analytics.track(
            "user_signed_up",
            { provider: account.providerId },
            account.userId,
          );
        },
      },
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        // Track account deletion (best-effort, user is being deleted)
        analytics.track("delete_account_completed", {}, user.id);

        // Cancel Polar subscription if user has one
        // This deletes the Polar customer, which automatically cancels any active
        // subscriptions and revokes benefits
        if (polarClient) {
          try {
            await polarClient.customers.deleteExternal({
              externalId: user.id,
            });
            logger.info("deleted Polar customer on account deletion", {
              userId: user.id,
            });
          } catch (err) {
            // Ignore 404 errors - user may never have had a Polar subscription
            // (free tier users who never upgraded)
            const isNotFound =
              err instanceof Error &&
              "statusCode" in err &&
              (err as { statusCode: number }).statusCode === 404;
            if (!isNotFound) {
              logger.error("failed to delete Polar customer", err, {
                userId: user.id,
              });
              // Don't block account deletion if Polar cleanup fails
            }
          }
        }
      },
      sendDeleteAccountVerification: async ({ user, url }) => {
        if (!resend) {
          throw new Error("Email service not configured");
        }
        await resend.emails.send({
          from: RESEND_FROM_EMAIL,
          to: user.email,
          subject: "Confirm your account deletion",
          react: DeleteAccountVerifyEmail({
            userName: user.name,
            confirmUrl: url,
          }),
        });
      },
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (update session if older than this)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: getEnabledProviders().map((p) => p.id),
    },
  },
  experimental: {
    joins: true,
  },
  plugins: polarClient
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
            }),
            portal(),
            webhooks({
              // biome-ignore lint/style/noNonNullAssertion: webhook secret is asserted above
              secret: process.env.POLAR_WEBHOOK_SECRET!,
              onSubscriptionCreated: handleSubscriptionCreated,
              onSubscriptionActive: handleSubscriptionActive,
              onSubscriptionCanceled: handleSubscriptionCanceled,
              onSubscriptionRevoked: handleSubscriptionRevoked,
            }),
          ],
        }),
      ]
    : [],
});

export type Session = typeof auth.$Infer.Session;
