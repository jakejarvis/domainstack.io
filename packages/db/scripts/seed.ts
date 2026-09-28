/**
 * Seed a local database with dev users and tracked domains.
 *
 *   pnpm db:seed              # refuses to run against a non-local DATABASE_URL
 *   pnpm db:seed -- --force   # run anyway
 *
 * Safe to re-run: users, accounts and tracked domains are upserted on fixed
 * keys, and the seeded users' notifications are replaced.
 */
import { config } from "dotenv";

config({ path: [".env", "../../apps/web/.env.local"], quiet: true });

const DEV_PASSWORD = "password123";

const DEV_USERS = [
  { id: "dev-user-free", name: "Free Dev", email: "free@dev.local", tier: "free" },
  { id: "dev-user-pro", name: "Pro Dev", email: "pro@dev.local", tier: "pro" },
] as const;

type TrackedState = "pending" | "verified" | "failing" | "archived";

/** Real, stable domains so the lookup pipeline has live data to fetch. */
const TRACKED: Record<(typeof DEV_USERS)[number]["id"], Array<[string, TrackedState]>> = {
  "dev-user-free": [
    ["example.com", "verified"],
    ["github.com", "verified"],
    ["vercel.com", "failing"],
    ["wikipedia.org", "pending"],
  ],
  "dev-user-pro": [
    ["example.com", "verified"],
    ["cloudflare.com", "verified"],
    ["mozilla.org", "verified"],
    ["stripe.com", "failing"],
    ["npmjs.com", "pending"],
    ["archive.org", "archived"],
  ],
};

const DAY = 24 * 60 * 60 * 1000;

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (checked packages/db/.env and apps/web/.env.local)");
  }
  const { hostname } = new URL(url);
  const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  if (!isLocal && !process.argv.includes("--force")) {
    throw new Error(
      `Refusing to seed non-local database at "${hostname}". Pass --force to override.`,
    );
  }
}

async function main() {
  assertLocalDatabase();

  // Imported after env loading so the db client sees DATABASE_URL
  const { randomBytes } = await import("node:crypto");
  const { hashPassword } = await import("@better-auth/utils/password");
  const { eq, inArray, sql } = await import("drizzle-orm");
  const { db } = await import("../src/client");
  const { accounts, domains, notifications, userTrackedDomains, users } =
    await import("../src/schema");
  const { ensureDomainRecord } = await import("../src/queries/domains");
  const { createNotification } = await import("../src/queries/notifications");
  const { createSubscription, updateUserTier } = await import("../src/queries/user-subscription");

  const password = await hashPassword(DEV_PASSWORD);
  const now = new Date();

  for (const user of DEV_USERS) {
    await db
      .insert(users)
      .values({ id: user.id, name: user.name, email: user.email, emailVerified: true })
      .onConflictDoUpdate({ target: users.id, set: { name: user.name, email: user.email } });

    // Better Auth's email/password provider stores the hash on a "credential" account
    await db
      .insert(accounts)
      .values({
        id: `${user.id}-credential`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password,
        updatedAt: now,
      })
      .onConflictDoUpdate({ target: accounts.id, set: { password, updatedAt: now } });

    await createSubscription(user.id);
    await updateUserTier(user.id, user.tier);

    const trackedIds: Record<string, string> = {};
    for (const [domainName, state] of TRACKED[user.id]) {
      const domain = await ensureDomainRecord(domainName);
      const verified = state === "verified" || state === "failing";
      const values = {
        verified,
        verificationMethod: verified ? ("dns_txt" as const) : null,
        verificationStatus:
          state === "failing"
            ? ("failing" as const)
            : verified
              ? ("verified" as const)
              : ("unverified" as const),
        verifiedAt: verified ? new Date(now.getTime() - 30 * DAY) : null,
        lastVerifiedAt: verified ? new Date(now.getTime() - DAY) : null,
        verificationFailedAt: state === "failing" ? new Date(now.getTime() - 2 * DAY) : null,
        archivedAt: state === "archived" ? new Date(now.getTime() - 7 * DAY) : null,
      };

      const [tracked] = await db
        .insert(userTrackedDomains)
        .values({
          userId: user.id,
          domainId: domain.id,
          verificationToken: randomBytes(16).toString("hex"),
          ...values,
        })
        .onConflictDoUpdate({
          target: [userTrackedDomains.userId, userTrackedDomains.domainId],
          set: values,
        })
        .returning({ id: userTrackedDomains.id });
      trackedIds[domainName] = tracked.id;
    }

    await db.delete(notifications).where(eq(notifications.userId, user.id));
    const [failingDomain] = TRACKED[user.id].find(([, state]) => state === "failing") ?? [];
    if (failingDomain) {
      await createNotification({
        userId: user.id,
        trackedDomainId: trackedIds[failingDomain],
        type: "verification_failing",
        title: `Verification failing for ${failingDomain}`,
        message: `We couldn't find the verification record for ${failingDomain}. Restore it to keep monitoring this domain.`,
        data: { domainName: failingDomain },
      });
    }
    await createNotification({
      userId: user.id,
      trackedDomainId: trackedIds["example.com"],
      type: "provider_change",
      title: "DNS provider changed for example.com",
      message: "example.com moved to a new DNS provider.",
      data: { domainName: "example.com" },
    });
  }

  // Mark the seeded domains as recently viewed so the warm-domains cron fills
  // in their report data (registration, DNS, certificates, …)
  const domainNames = [...new Set(Object.values(TRACKED).flatMap((list) => list.map(([d]) => d)))];
  await db
    .update(domains)
    .set({ lastAccessedAt: sql`now()` })
    .where(inArray(domains.name, domainNames));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  // Only echo the documented dev default; never print a real secret
  const secret = process.env.CRON_SECRET === "dev" ? "dev" : "$CRON_SECRET";
  console.info(`
Seeded ${DEV_USERS.length} users. Sign in at ${baseUrl}/login with:
${DEV_USERS.map((u) => `  ${u.email} / ${DEV_PASSWORD} (${u.tier})`).join("\n")}

With \`pnpm dev\` running, fill in report data and change-detection baselines:
  curl -H "Authorization: Bearer ${secret}" ${baseUrl}/api/cron/warm-domains
  curl -H "Authorization: Bearer ${secret}" ${baseUrl}/api/cron/monitor-domains
${secret === "dev" ? "" : "(set CRON_SECRET in your shell to the value in apps/web/.env.local)\n"}`);
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
