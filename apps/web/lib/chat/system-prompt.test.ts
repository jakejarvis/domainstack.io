/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { buildClientSystemPrompt, formatPromptDate, sanitizeDomain } from "./system-prompt";

const now = new Date("2026-08-27T12:00:00.000Z");
const today = "Thursday, August 27, 2026";

describe("formatPromptDate", () => {
  it("formats a UTC calendar date for the model", () => {
    expect(formatPromptDate(now)).toBe(today);
  });
});

describe("sanitizeDomain", () => {
  it("passes through a valid domain", () => {
    expect(sanitizeDomain("example.com")).toBe("example.com");
  });

  it("drops a malformed domain", () => {
    expect(sanitizeDomain("not a domain")).toBeUndefined();
    expect(sanitizeDomain("not\na\ndomain")).toBeUndefined();
  });

  it("passes through undefined", () => {
    expect(sanitizeDomain(undefined)).toBeUndefined();
  });
});

describe("buildClientSystemPrompt", () => {
  it("includes today's date", () => {
    expect(buildClientSystemPrompt(undefined, now)).toContain(`Today is ${today}.`);
  });

  it("uses the viewing domain as the default", () => {
    const prompt = buildClientSystemPrompt("example.com", now);
    expect(prompt).toContain("The user is viewing example.com.");
    expect(prompt).not.toContain("ask which one to look up");
  });

  it("asks for a domain when none is in context", () => {
    expect(buildClientSystemPrompt(undefined, now)).toContain(
      "If no domain is specified, ask which one to look up.",
    );
  });

  it("does not interpolate an invalid domain", () => {
    const prompt = buildClientSystemPrompt("not a domain", now);
    expect(prompt).not.toContain("not a domain");
    expect(prompt).toContain("If no domain is specified, ask which one to look up.");
  });

  it("identifies the assistant by product name", () => {
    expect(buildClientSystemPrompt(undefined, now)).toContain("You are Stacky");
  });
});
