import { describe, expect, it } from "vitest";

import { isFrameworkRequestError } from "./ignored-request-errors";

describe("isFrameworkRequestError", () => {
  it("ignores the Server Actions CSRF rejection", () => {
    expect(isFrameworkRequestError(new Error("Invalid Server Actions request."))).toBe(true);
  });

  it("ignores the rejection when Next.js appends detail to the message", () => {
    expect(isFrameworkRequestError(new Error("Invalid Server Actions request. extra"))).toBe(true);
  });

  it("matches a string error as well as an Error instance", () => {
    expect(isFrameworkRequestError("Invalid Server Actions request.")).toBe(true);
  });

  it("keeps real application errors", () => {
    expect(isFrameworkRequestError(new Error("Domain not found"))).toBe(false);
  });

  it("keeps non-error values that are not framework rejections", () => {
    expect(isFrameworkRequestError(undefined)).toBe(false);
    expect(isFrameworkRequestError({ message: "Invalid Server Actions request." })).toBe(false);
  });
});
