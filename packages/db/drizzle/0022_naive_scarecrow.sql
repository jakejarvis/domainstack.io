-- better-auth 1.7.3 reverted account identification to (providerId, accountId), like 1.6,
-- and no longer sets `issuer` on insert. Relax the constraints 0019 added for the 1.7.0-1.7.2
-- account-identity model so new sign-ups/links don't fail a NOT NULL/unique violation.
-- The column itself is left in place (nullable, unused) rather than dropped, so this stays
-- safe to run before or after the better-auth 1.7.3 code deploys.
-- See https://better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-keeps-the-provider-key
DROP INDEX "accounts_issuer_accountId_uidx";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" DROP NOT NULL;