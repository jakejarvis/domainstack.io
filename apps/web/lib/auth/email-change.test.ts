import { describe, expect, it } from "vitest";

import {
  isEmailChangeVerification,
  previousEmailForUpdate,
  readEmailChangeToken,
} from "@domainstack/auth/email-change";

function token(payload: unknown): string {
  return ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");
}

const requestType = "change-email-verification";
const change = token({ email: "Old@Example.com", updateTo: "New@Example.com", requestType });

describe("readEmailChangeToken", () => {
  it("reads and lowercases both addresses from a change-email token", () => {
    expect(readEmailChangeToken(change)).toEqual({
      previousEmail: "old@example.com",
      newEmail: "new@example.com",
    });
  });

  it.each(["change-email-confirmation", undefined, "other"])(
    "returns null for requestType %s",
    (type) => {
      expect(
        readEmailChangeToken(
          token({ email: "old@example.com", updateTo: "new@example.com", requestType: type }),
        ),
      ).toBeNull();
    },
  );

  it("returns null for a plain email-verification token", () => {
    expect(readEmailChangeToken(token({ email: "a@b.co" }))).toBeNull();
  });

  it.each([
    { requestType, email: "a@b.co" },
    { requestType, updateTo: "a@b.co" },
    { requestType, email: 1, updateTo: "a@b.co" },
  ])("returns null when an address is missing or mistyped: %j", (payload) => {
    expect(readEmailChangeToken(token(payload))).toBeNull();
  });

  it.each([undefined, null, 42, "", "abc", "a.b", "a.%%%.c", token(null), token("text")])(
    "returns null for malformed input %j",
    (input) => {
      expect(readEmailChangeToken(input)).toBeNull();
    },
  );
});

describe("isEmailChangeVerification", () => {
  it("is true for /verify-email with a change-email token", () => {
    expect(isEmailChangeVerification({ path: "/verify-email", query: { token: change } })).toBe(
      true,
    );
  });

  it("is false for /verify-email with a plain verification token", () => {
    expect(
      isEmailChangeVerification({
        path: "/verify-email",
        query: { token: token({ email: "a@b.co" }) },
      }),
    ).toBe(false);
  });

  it("is false on any other path", () => {
    expect(isEmailChangeVerification({ path: "/change-email", query: { token: change } })).toBe(
      false,
    );
  });

  it("is false without a query", () => {
    expect(isEmailChangeVerification({ path: "/verify-email" })).toBe(false);
  });
});

describe("previousEmailForUpdate", () => {
  const verifyCtx = { path: "/verify-email", query: { token: change } };

  it("returns the old address when the update applies the change", () => {
    expect(previousEmailForUpdate({ email: "new@example.com" }, verifyCtx)).toBe("old@example.com");
  });

  it("compares the new address case-insensitively", () => {
    expect(previousEmailForUpdate({ email: "NEW@example.com" }, verifyCtx)).toBe("old@example.com");
  });

  it("returns null without a request context", () => {
    expect(previousEmailForUpdate({ email: "new@example.com" }, null)).toBeNull();
  });

  it("returns null when the user's email is not the token's target", () => {
    expect(previousEmailForUpdate({ email: "someone@example.com" }, verifyCtx)).toBeNull();
  });

  it("returns null on any other path", () => {
    expect(
      previousEmailForUpdate(
        { email: "new@example.com" },
        { path: "/callback/github", query: { token: change } },
      ),
    ).toBeNull();
  });

  it("returns null when the update matched no row", () => {
    expect(previousEmailForUpdate(undefined, verifyCtx)).toBeNull();
  });
});
