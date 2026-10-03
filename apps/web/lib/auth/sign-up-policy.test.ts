import { describe, expect, it } from "vitest";

import { gitlabEmailVerified, rejectUnverifiedSignUp } from "@domainstack/auth/sign-up-policy";

describe("gitlabEmailVerified", () => {
  it("is true for a confirmed account", () => {
    expect(gitlabEmailVerified({ confirmed_at: "2024-01-01T00:00:00Z" })).toBe(true);
  });

  it("is false when confirmed_at is null", () => {
    expect(gitlabEmailVerified({ confirmed_at: null })).toBe(false);
  });

  it("is false when confirmed_at is missing", () => {
    expect(gitlabEmailVerified({})).toBe(false);
  });

  it("is false when confirmed_at is empty", () => {
    expect(gitlabEmailVerified({ confirmed_at: "" })).toBe(false);
  });

  it("is false for GitLab's placeholder OAuth email", () => {
    expect(
      gitlabEmailVerified({
        confirmed_at: "2024-01-01T00:00:00Z",
        email: "temp-email-for-oauth-jdoe@gitlab.localhost",
      }),
    ).toBe(false);
  });
});

describe("rejectUnverifiedSignUp", () => {
  const oauth = { providerId: "gitlab" };

  it("allows a verified sign-up", () => {
    expect(
      rejectUnverifiedSignUp({
        user: { emailVerified: true },
        source: { action: "create-user", oauth },
      }),
    ).toBeUndefined();
  });

  it.each([false, undefined, null])("refuses a sign-up with emailVerified %s", (emailVerified) => {
    expect(
      rejectUnverifiedSignUp({
        user: { emailVerified },
        source: { action: "create-user", oauth },
      }),
    ).toEqual({ error: "email_not_verified", errorDescription: expect.any(String) });
  });

  it("never blocks sign-in of existing users", () => {
    expect(
      rejectUnverifiedSignUp({
        user: { emailVerified: false },
        source: { action: "sign-in", oauth },
      }),
    ).toBeUndefined();
  });

  it("never blocks linking an account from Settings", () => {
    expect(
      rejectUnverifiedSignUp({
        user: { emailVerified: false },
        source: { action: "link-account", oauth },
      }),
    ).toBeUndefined();
  });
});
