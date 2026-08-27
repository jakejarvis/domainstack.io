/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { CHATBOT_NAME } from "@domainstack/constants";

import { buildSystemPrompt, formatPromptDate } from "./system-prompt";

const now = new Date("2026-08-27T12:00:00.000Z");
const today = "Thursday, August 27, 2026";

describe("formatPromptDate", () => {
  it("formats a UTC calendar date for the model", () => {
    expect(formatPromptDate(now)).toBe(today);
  });
});

describe("buildSystemPrompt", () => {
  it("includes today's date in both variants", () => {
    expect(buildSystemPrompt({ variant: "cloud", now })).toContain(`Today is ${today}.`);
    expect(buildSystemPrompt({ variant: "client", now })).toContain(`Today is ${today}.`);
  });

  it("uses the viewing domain as the default", () => {
    const prompt = buildSystemPrompt({ variant: "cloud", domain: "example.com", now });
    expect(prompt).toContain("The user is viewing example.com.");
    expect(prompt).not.toContain("ask which one to look up");
  });

  it("asks for a domain when none is in context", () => {
    expect(buildSystemPrompt({ variant: "cloud", now })).toContain(
      "If no domain is specified, ask which one to look up.",
    );
  });

  it("does not interpolate an invalid domain", () => {
    const prompt = buildSystemPrompt({ variant: "client", domain: "not a domain", now });
    expect(prompt).not.toContain("not a domain");
    expect(prompt).toContain("If no domain is specified, ask which one to look up.");
  });

  it("requires root domains and a parallel overview lookup", () => {
    const cloud = buildSystemPrompt({ variant: "cloud", now });
    expect(cloud).toContain("registrable root domain");
    expect(cloud).toContain("get_registration, get_dns_records, get_certificates, get_hosting");
    expect(cloud).toContain("Independent lookups must be issued together");
  });

  it("gates the account pitch and forbids fabricating data", () => {
    const cloud = buildSystemPrompt({ variant: "cloud", now });
    expect(cloud).toContain("NEVER fabricate domain information.");
    expect(cloud).toContain(
      "Mention a free Domainstack account only if the user asks for those features.",
    );
  });

  it("identifies the assistant by product name", () => {
    expect(buildSystemPrompt({ variant: "cloud", now })).toContain(`You are ${CHATBOT_NAME}`);
    expect(buildSystemPrompt({ variant: "client", now })).toContain(`You are ${CHATBOT_NAME}`);
  });
});
