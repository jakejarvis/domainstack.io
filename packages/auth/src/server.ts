import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { dash } from "@better-auth/infra";
import { waitUntil } from "@vercel/functions";
import { createAuthMiddleware, getAuthoritativeSessionFromCtx } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";

import { db } from "@domainstack/db/client";
import { createSubscription } from "@domainstack/db/queries/user-subscription";
import * as schema from "@domainstack/db/schema";
import { addContact, removeContact, replaceContact, sendEmail } from "@domainstack/email";
import ConfirmEmailChangeEmail from "@domainstack/email/templates/confirm-email-change";
import DeleteAccountVerifyEmail from "@domainstack/email/templates/delete-account-verify";
import EmailChangedNoticeEmail from "@domainstack/email/templates/email-changed-notice";
import { createLogger } from "@domainstack/logger";
import { checkout, polar, portal, webhooks } from "@domainstack/polar/better-auth/server";
import {
  handleOrderPaid,
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
  handleSubscriptionUncanceled,
} from "@domainstack/polar/handlers";
import { getProductsForCheckout } from "@domainstack/polar/products";
import { polarClient } from "@domainstack/polar/server";
import { getRedis } from "@domainstack/redis";
import { getBaseUrl } from "@domainstack/utils/base-url";

import { analytics } from "./analytics";
import {
  isEmailChangeVerification,
  previousEmailForUpdate,
  readEmailChangeToken,
} from "./email-change";
import { buildOAuthProviders, validateOAuthCredentialPair } from "./providers";
import { gitlabEmailVerified, rejectUnverifiedSignUp } from "./sign-up-policy";
import { createRedisStorage } from "./storage";

const logger = createLogger({ source: "auth" });

const redis = getRedis();

// Local development also allows email/password sign-in (for seeded dev users),
// so OAuth apps are optional there.
const isDev = process.env.NODE_ENV === "development";

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

// Ensure at least one OAuth provider is configured (outside local development)
if (enabledProviders.length === 0 && !isDev) {
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
  // The app never lets users edit their profile; this endpoint would otherwise
  // let a signed-in user point `image` at any URL (served by /api/avatar).
  disabledPaths: [
    "/update-user",
    // Never called by the app; they would hand provider tokens to script on our origin.
    "/get-access-token",
    "/refresh-token",
    "/account-info",
    // Without a session it emails a verification link to any unverified user;
    // the only verification mail this app sends is the change-email link.
    "/send-verification-email",
    // Polar customer endpoints the app doesn't use. /customer/subscriptions/list
    // queries Polar org-wide by a caller-supplied reference_id.
    "/customer/state",
    "/customer/benefits/list",
    "/customer/subscriptions/list",
    "/customer/orders/list",
  ],
  // OAuth failures we can't attribute to a flow (unreadable state, bad callback)
  // land on /login, where useAuthCallback toasts the error and offers a retry.
  // Without this they hit /api/auth/error, which in production bounces to /?error=.
  onAPIError: {
    errorURL: "/login",
  },
  hooks: {
    // Better Auth signs in whoever opens a change-email link when there's no
    // session, so a mistyped address or a mail scanner could take the account.
    // Only the requester's own signed-in browser may finish the change.
    before: createAuthMiddleware(async (ctx) => {
      if (!isEmailChangeVerification(ctx)) return;
      // Read from the database, not the 5-minute cookie cache, so a session
      // revoked moments ago doesn't count.
      if (await getAuthoritativeSessionFromCtx(ctx)) return;
      throw ctx.redirect("/login?error=email_change_sign_in_required");
    }),
  },
  logger: {
    log: (level, message, ...args) => {
      const logFn = logger[level].bind(logger);
      logFn({ extra: args }, message);
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create free tier subscription for new users (do not defer).
          // Best-effort: getUserSubscription lazily creates the row if this insert is lost.
          await createSubscription(user.id).catch((err: unknown) =>
            logger.error({ err, userId: user.id }, "failed to create free-tier subscription"),
          );

          // Create Resend contact for marketing communications. `waitUntil`
          // never awaits the promise itself, so a rejection escaping here is an
          // unhandled rejection that takes down the invocation.
          waitUntil(
            addContact(user.email, user.name).catch((err: unknown) =>
              logger.error({ err, userId: user.id }, "failed to add Resend contact"),
            ),
          );

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
      update: {
        after: async (user, ctx) => {
          const previousEmail = previousEmailForUpdate(user, ctx);
          if (!previousEmail) return;

          logger.info({ userId: user.id }, "email address changed");
          const baseUrl = getBaseUrl();

          // Polar's plugin updates the customer email on its own hook.
          waitUntil(
            replaceContact(previousEmail, user.email, user.name).catch((err: unknown) =>
              logger.error({ err, userId: user.id }, "failed to move Resend contact"),
            ),
          );
          waitUntil(
            sendEmail(
              {
                to: previousEmail,
                subject: "Your Domainstack email address was changed",
                react: EmailChangedNoticeEmail({ userName: user.name, baseUrl }),
              },
              { baseUrl },
            ).catch((err: unknown) =>
              logger.error({ err, userId: user.id }, "failed to send email change notice"),
            ),
          );
          analytics.track("email_changed", { $set: { email: user.email } }, user.id);
        },
      },
    },
  },
  user: {
    // Without this, whoever first signs in with an address owns it (implicit
    // linking is off), even if the provider never verified it.
    validateUserInfo: rejectUnverifiedSignUp,
    // The new address gets a link; the change applies when it's opened in the
    // requester's signed-in browser (hooks.before). No confirmation step on the
    // old address: losing access to it is the usual reason to change. The old
    // address gets a notice instead (databaseHooks.user.update.after).
    changeEmail: {
      enabled: true,
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        // Delete Resend contact
        waitUntil(
          removeContact(user.email).catch((err: unknown) =>
            logger.error({ err, userId: user.id }, "failed to remove Resend contact"),
          ),
        );
      },
      sendDeleteAccountVerification: async ({ user, url }) => {
        waitUntil(
          (async () => {
            const baseUrl = getBaseUrl();
            await sendEmail(
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
          })().catch((err: unknown) =>
            logger.error({ err, userId: user.id }, "failed to send delete account verification"),
          ),
        );
      },
    },
  },
  emailVerification: {
    expiresIn: 60 * 60, // the email says "1 hour"
    sendVerificationEmail: async ({ user, url, token }) => {
      // `user.email` is the new address here. Only change-email links are sent;
      // anything else means a Better Auth flow we haven't reviewed.
      if (!readEmailChangeToken(token)) {
        logger.warn({ userId: user.id }, "refused to send a non-change-email verification link");
        return;
      }
      if (isDev) {
        // No Resend locally: this is how to get the link in development.
        logger.info({ userId: user.id, url }, "email change link (development only)");
      }
      waitUntil(
        (async () => {
          const baseUrl = getBaseUrl();
          await sendEmail(
            {
              to: user.email,
              subject: "Confirm your new email address",
              react: ConfirmEmailChangeEmail({
                userName: user.name,
                newEmail: user.email,
                confirmUrl: url,
                baseUrl,
              }),
            },
            { baseUrl },
          );
        })().catch((err: unknown) =>
          logger.error({ err, userId: user.id }, "failed to send email change link"),
        ),
      );
    },
  },
  socialProviders: {
    ...socialProviders,
    // GitLab has no email_verified field; derive it so confirmed users can sign up.
    ...(socialProviders.gitlab && {
      gitlab: {
        ...socialProviders.gitlab,
        mapProfileToUser: (profile) => ({ emailVerified: gitlabEmailVerified(profile) }),
      },
    }),
  },
  emailAndPassword: {
    enabled: isDev,
    // Dev accounts come from `pnpm db:seed`; no need to expose sign-up
    disableSignUp: true,
  },
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
    // Each request emails a link to an address the user typed.
    customRules: {
      "/change-email": { window: 60 * 60, max: 5 },
    },
  },
  account: {
    // Provider tokens are stored encrypted with BETTER_AUTH_SECRET. Existing
    // plaintext rows still read back as-is and are re-encrypted on next sign-in.
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      // Linking a second provider happens only from Settings while signed in.
      // Implicit linking at sign-in trusts the provider's email claim, and
      // GitLab/Vercel may report unverified emails.
      disableImplicitLinking: true,
      trustedProviders: enabledProviders,
      // Accounts are keyed by user ID, not email: once a user changes their
      // email, the providers they link can report any address. Linking happens
      // only from Settings, signed in to both accounts.
      allowDifferentEmails: true,
      allowUnlinkingAll: false,
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
});

export type Session = typeof auth.$Infer.Session;

// Re-export Next.js utilities for consumers
export { toNextJsHandler };
