import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "auth" });

/**
 * GitLab's /user has no email_verified. Mirrors GitLab's own
 * `primary_email_verified?`: the account is confirmed and its email isn't the
 * placeholder GitLab assigns when its own OAuth sign-up got no address.
 */
export function gitlabEmailVerified(profile: {
  confirmed_at?: string | null;
  email?: string | null;
}): boolean {
  return (
    typeof profile.confirmed_at === "string" &&
    profile.confirmed_at.length > 0 &&
    typeof profile.email === "string" &&
    profile.email.length > 0 &&
    !profile.email.startsWith("temp-email-for-oauth")
  );
}

/**
 * `user.validateUserInfo` gate: only a provider-verified email may create an
 * account. Sign-ins and Settings links are left alone; rejecting sign-ins would
 * lock out existing users whose rows predate this check.
 *
 * Better Auth redirects a rejection to /login?error=email_not_verified, which
 * errors.ts already explains to the user.
 */
export function rejectUnverifiedSignUp({
  user,
  source,
}: {
  user: { emailVerified?: boolean | null };
  source: { action: string; oauth?: { providerId: string } };
}): { error: "email_not_verified"; errorDescription: string } | undefined {
  if (source.action !== "create-user" || user.emailVerified === true) return undefined;
  logger.warn(
    { providerId: source.oauth?.providerId },
    "refused sign-up from an unverified provider email",
  );
  return {
    error: "email_not_verified",
    errorDescription: "Email address is not verified with this provider",
  };
}
