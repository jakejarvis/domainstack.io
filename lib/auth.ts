import "server-only";

import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { BASE_URL } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { createSubscription } from "@/lib/db/repos/user-subscription";
import * as schema from "@/lib/db/schema";
import {
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
} from "@/lib/polar/handlers";
import { getProductsForCheckout } from "@/lib/polar/products";

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
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createSubscription(user.id);
        },
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
      trustedProviders: ["github"],
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
              successUrl: "/dashboard?upgraded=true",
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
