import "server-only";

import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { BASE_URL } from "@/lib/constants";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import {
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
} from "@/lib/polar/handlers";
import { getProductsForCheckout } from "@/lib/polar/products";

// Initialize Polar client (only if configured)
const polarClient = process.env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
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
          // Create subscription record for new user (defaults to free tier)
          await db.insert(schema.userSubscriptions).values({ userId: user.id });
        },
      },
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
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
          // Automatically create Polar customer when user signs up
          createCustomerOnSignUp: true,
          use: [
            checkout({
              products: getProductsForCheckout(),
              successUrl: "/dashboard?upgraded=true",
              authenticatedUsersOnly: true,
            }),
            portal(),
            webhooks({
              secret: process.env.POLAR_WEBHOOK_SECRET ?? "",
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
