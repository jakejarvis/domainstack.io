import "server-only";

import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { after } from "next/server";
import { DeleteAccountVerifyEmail } from "@/emails/delete-account-verify";
import { BASE_URL } from "@/lib/constants";
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
// Polar is optional, but webhook secret is required if Polar is enabled
if (process.env.POLAR_ACCESS_TOKEN && !process.env.POLAR_WEBHOOK_SECRET) {
  throw new Error(
    "POLAR_WEBHOOK_SECRET is required when POLAR_ACCESS_TOKEN is set",
  );
}
// GitHub OAuth is optional, but both credentials are required if either is set
if (
  (process.env.GITHUB_CLIENT_ID && !process.env.GITHUB_CLIENT_SECRET) ||
  (!process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
) {
  throw new Error(
    "Both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required when using GitHub OAuth",
  );
}
// GitLab OAuth is optional, but both credentials are required if either is set
if (
  (process.env.GITLAB_CLIENT_ID && !process.env.GITLAB_CLIENT_SECRET) ||
  (!process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET)
) {
  throw new Error(
    "Both GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET are required when using GitLab OAuth",
  );
}
// Google OAuth is optional, but both credentials are required if either is set
if (
  (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_SECRET) ||
  (!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
) {
  throw new Error(
    "Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when using Google OAuth",
  );
}
// Vercel OAuth is optional, but both credentials are required if either is set
if (
  (process.env.VERCEL_CLIENT_ID && !process.env.VERCEL_CLIENT_SECRET) ||
  (!process.env.VERCEL_CLIENT_ID && process.env.VERCEL_CLIENT_SECRET)
) {
  throw new Error(
    "Both VERCEL_CLIENT_ID and VERCEL_CLIENT_SECRET are required when using Vercel OAuth",
  );
}
// Ensure at least one OAuth provider is configured
if (
  !process.env.GITHUB_CLIENT_ID &&
  !process.env.GITLAB_CLIENT_ID &&
  !process.env.GOOGLE_CLIENT_ID &&
  !process.env.VERCEL_CLIENT_ID
) {
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

// Build list of enabled OAuth providers based on server-side credentials
// This ensures trustedProviders always matches socialProviders configuration
const enabledProviders: string[] = [];
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  enabledProviders.push("github");
}
if (process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET) {
  enabledProviders.push("gitlab");
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  enabledProviders.push("google");
}
if (process.env.VERCEL_CLIENT_ID && process.env.VERCEL_CLIENT_SECRET) {
  enabledProviders.push("vercel");
}

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

          // Create Resend contact for marketing communications
          try {
            // Parse name into first/last (best-effort)
            const nameParts = user.name?.trim().split(/\s+/) || [];
            const firstName = nameParts[0];
            const lastName =
              nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

            await resend?.contacts.create({
              email: user.email,
              firstName,
              lastName,
              unsubscribed: false,
            });
          } catch (err) {
            logger.error("failed to create Resend contact", err, {
              userId: user.id,
            });
          }
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

        // Delete Resend contact
        try {
          await resend?.contacts.remove({
            email: user.email,
          });
        } catch (err) {
          logger.error("failed to delete Resend contact", err, {
            userId: user.id,
          });
        }
      },
      sendDeleteAccountVerification: async ({ user, url }) => {
        // Use after() to reduce risk of timing attacks
        after(() =>
          resend?.emails.send({
            from: `Domainstack <${RESEND_FROM_EMAIL}>`,
            to: user.email,
            subject: "Confirm your account deletion",
            react: DeleteAccountVerifyEmail({
              userName: user.name,
              confirmUrl: url,
            }),
          }),
        );
      },
    },
  },
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }),
    ...(process.env.GITLAB_CLIENT_ID &&
      process.env.GITLAB_CLIENT_SECRET && {
        gitlab: {
          clientId: process.env.GITLAB_CLIENT_ID,
          clientSecret: process.env.GITLAB_CLIENT_SECRET,
        },
      }),
    ...(process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }),
    ...(process.env.VERCEL_CLIENT_ID &&
      process.env.VERCEL_CLIENT_SECRET && {
        vercel: {
          clientId: process.env.VERCEL_CLIENT_ID,
          clientSecret: process.env.VERCEL_CLIENT_SECRET,
        },
      }),
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
      trustedProviders: enabledProviders,
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
