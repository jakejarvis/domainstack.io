/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { DetectionContext, Rule } from "./rules";
import { evalRule } from "./rules";

const emptyContext: DetectionContext = {
  headers: {},
  mx: [],
  ns: [],
};

describe("evalRule", () => {
  describe("headerEquals", () => {
    it("returns true for exact case-insensitive match", () => {
      const rule: Rule = {
        kind: "headerEquals",
        name: "server",
        value: "vercel",
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { server: "Vercel" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false for no match", () => {
      const rule: Rule = {
        kind: "headerEquals",
        name: "server",
        value: "vercel",
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { server: "Apache" },
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("returns false for missing header", () => {
      const rule: Rule = {
        kind: "headerEquals",
        name: "server",
        value: "vercel",
      };

      expect(evalRule(rule, emptyContext)).toBe(false);
    });

    it("handles case-insensitive header names", () => {
      const rule: Rule = {
        kind: "headerEquals",
        name: "X-Powered-By",
        value: "next.js",
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-powered-by": "Next.js" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });
  });

  describe("headerIncludes", () => {
    it("returns true when header includes substring", () => {
      const rule: Rule = {
        kind: "headerIncludes",
        name: "server",
        substr: "nginx",
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { server: "nginx/1.18.0 (Ubuntu)" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false when header does not include substring", () => {
      const rule: Rule = {
        kind: "headerIncludes",
        name: "server",
        substr: "apache",
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { server: "nginx/1.18.0" },
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("is case-insensitive", () => {
      const rule: Rule = {
        kind: "headerIncludes",
        name: "Server",
        substr: "NGINX",
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { server: "nginx/1.18.0" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });
  });

  describe("headerPresent", () => {
    it("returns true when header is present", () => {
      const rule: Rule = { kind: "headerPresent", name: "x-vercel-id" };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-vercel-id": "abc123" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false when header is missing", () => {
      const rule: Rule = { kind: "headerPresent", name: "x-vercel-id" };

      expect(evalRule(rule, emptyContext)).toBe(false);
    });

    it("is case-insensitive for header name", () => {
      const rule: Rule = { kind: "headerPresent", name: "X-Vercel-ID" };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-vercel-id": "abc" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });
  });

  describe("mxSuffix", () => {
    it("returns true for exact match", () => {
      const rule: Rule = { kind: "mxSuffix", suffix: "google.com" };
      const ctx: DetectionContext = {
        ...emptyContext,
        mx: ["google.com"],
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns true for subdomain match", () => {
      const rule: Rule = { kind: "mxSuffix", suffix: "google.com" };
      const ctx: DetectionContext = {
        ...emptyContext,
        mx: ["aspmx.l.google.com"],
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false for partial match that is not a suffix", () => {
      const rule: Rule = { kind: "mxSuffix", suffix: "google.com" };
      const ctx: DetectionContext = {
        ...emptyContext,
        mx: ["notgoogle.com"],
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("returns false for empty mx array", () => {
      const rule: Rule = { kind: "mxSuffix", suffix: "google.com" };

      expect(evalRule(rule, emptyContext)).toBe(false);
    });

    it("is case-insensitive", () => {
      const rule: Rule = { kind: "mxSuffix", suffix: "GOOGLE.COM" };
      const ctx: DetectionContext = {
        ...emptyContext,
        mx: ["aspmx.l.google.com"],
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });
  });

  describe("mxRegex", () => {
    it("returns true when regex matches", () => {
      const rule: Rule = { kind: "mxRegex", pattern: "google\\.com$" };
      const ctx: DetectionContext = {
        ...emptyContext,
        mx: ["aspmx.l.google.com"],
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false when regex does not match", () => {
      const rule: Rule = { kind: "mxRegex", pattern: "^office365" };
      const ctx: DetectionContext = {
        ...emptyContext,
        mx: ["aspmx.l.google.com"],
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("respects flags parameter", () => {
      const rule: Rule = { kind: "mxRegex", pattern: "GOOGLE", flags: "" };
      const ctx: DetectionContext = {
        ...emptyContext,
        mx: ["google.com"],
      };

      // Without 'i' flag, should not match lowercase
      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("defaults to case-insensitive matching", () => {
      const rule: Rule = { kind: "mxRegex", pattern: "GOOGLE" };
      const ctx: DetectionContext = {
        ...emptyContext,
        mx: ["google.com"],
      };

      // Default is 'i' flag
      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false for invalid regex (graceful failure)", () => {
      const rule: Rule = { kind: "mxRegex", pattern: "[invalid(" };
      const ctx: DetectionContext = {
        ...emptyContext,
        mx: ["test.com"],
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });
  });

  describe("nsSuffix", () => {
    it("returns true for exact match", () => {
      const rule: Rule = { kind: "nsSuffix", suffix: "cloudflare.com" };
      const ctx: DetectionContext = {
        ...emptyContext,
        ns: ["cloudflare.com"],
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns true for subdomain match", () => {
      const rule: Rule = { kind: "nsSuffix", suffix: "cloudflare.com" };
      const ctx: DetectionContext = {
        ...emptyContext,
        ns: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false for no match", () => {
      const rule: Rule = { kind: "nsSuffix", suffix: "cloudflare.com" };
      const ctx: DetectionContext = {
        ...emptyContext,
        ns: ["ns1.example.com"],
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });
  });

  describe("nsRegex", () => {
    it("returns true when regex matches", () => {
      const rule: Rule = {
        kind: "nsRegex",
        pattern: "^ns-\\d+\\.awsdns",
        flags: "i",
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        ns: ["ns-2048.awsdns-64.com"],
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false for invalid regex (graceful failure)", () => {
      const rule: Rule = { kind: "nsRegex", pattern: "**invalid**" };
      const ctx: DetectionContext = {
        ...emptyContext,
        ns: ["ns1.example.com"],
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });
  });

  describe("issuerEquals", () => {
    it("returns true for exact case-insensitive match", () => {
      const rule: Rule = { kind: "issuerEquals", value: "r3" };
      const ctx: DetectionContext = {
        ...emptyContext,
        issuer: "r3",
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false for no match", () => {
      const rule: Rule = { kind: "issuerEquals", value: "r3" };
      const ctx: DetectionContext = {
        ...emptyContext,
        issuer: "digicert",
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("returns false for undefined issuer", () => {
      const rule: Rule = { kind: "issuerEquals", value: "r3" };

      expect(evalRule(rule, emptyContext)).toBe(false);
    });
  });

  describe("issuerIncludes", () => {
    it("returns true when issuer includes substring", () => {
      const rule: Rule = { kind: "issuerIncludes", substr: "let's encrypt" };
      const ctx: DetectionContext = {
        ...emptyContext,
        issuer: "let's encrypt r3",
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false when issuer does not include substring", () => {
      const rule: Rule = { kind: "issuerIncludes", substr: "let's encrypt" };
      const ctx: DetectionContext = {
        ...emptyContext,
        issuer: "digicert global root",
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("returns false for undefined issuer", () => {
      const rule: Rule = { kind: "issuerIncludes", substr: "test" };

      expect(evalRule(rule, emptyContext)).toBe(false);
    });
  });

  describe("registrarEquals", () => {
    it("returns true for exact case-insensitive match", () => {
      const rule: Rule = { kind: "registrarEquals", value: "godaddy" };
      const ctx: DetectionContext = {
        ...emptyContext,
        registrar: "godaddy",
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false for undefined registrar", () => {
      const rule: Rule = { kind: "registrarEquals", value: "godaddy" };

      expect(evalRule(rule, emptyContext)).toBe(false);
    });
  });

  describe("registrarIncludes", () => {
    it("returns true when registrar includes substring", () => {
      const rule: Rule = { kind: "registrarIncludes", substr: "godaddy" };
      const ctx: DetectionContext = {
        ...emptyContext,
        registrar: "godaddy.com, llc",
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false for undefined registrar", () => {
      const rule: Rule = { kind: "registrarIncludes", substr: "test" };

      expect(evalRule(rule, emptyContext)).toBe(false);
    });
  });

  describe("all combinator", () => {
    it("returns true when all rules match", () => {
      const rule: Rule = {
        all: [
          { kind: "headerPresent", name: "x-vercel-id" },
          { kind: "headerEquals", name: "server", value: "vercel" },
        ],
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-vercel-id": "abc", server: "Vercel" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false when any rule does not match", () => {
      const rule: Rule = {
        all: [
          { kind: "headerPresent", name: "x-vercel-id" },
          { kind: "headerEquals", name: "server", value: "vercel" },
        ],
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-vercel-id": "abc", server: "Apache" },
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("returns true for empty all array", () => {
      const rule: Rule = { all: [] };

      expect(evalRule(rule, emptyContext)).toBe(true);
    });

    it("handles deeply nested all combinators", () => {
      const rule: Rule = {
        all: [
          {
            all: [
              { kind: "headerPresent", name: "x-test" },
              {
                all: [{ kind: "headerEquals", name: "server", value: "test" }],
              },
            ],
          },
        ],
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-test": "1", server: "Test" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });
  });

  describe("any combinator", () => {
    it("returns true when at least one rule matches", () => {
      const rule: Rule = {
        any: [
          { kind: "headerEquals", name: "server", value: "vercel" },
          { kind: "headerEquals", name: "server", value: "netlify" },
        ],
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { server: "Netlify" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false when no rules match", () => {
      const rule: Rule = {
        any: [
          { kind: "headerEquals", name: "server", value: "vercel" },
          { kind: "headerEquals", name: "server", value: "netlify" },
        ],
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { server: "Apache" },
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("returns false for empty any array", () => {
      const rule: Rule = { any: [] };

      expect(evalRule(rule, emptyContext)).toBe(false);
    });

    it("handles deeply nested any combinators", () => {
      const rule: Rule = {
        any: [
          {
            any: [
              { kind: "headerEquals", name: "server", value: "vercel" },
              {
                any: [
                  { kind: "headerEquals", name: "server", value: "netlify" },
                ],
              },
            ],
          },
        ],
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { server: "Netlify" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });
  });

  describe("not combinator", () => {
    it("returns true when inner rule does not match", () => {
      const rule: Rule = {
        not: { kind: "headerPresent", name: "x-blocked" },
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-allowed": "yes" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("returns false when inner rule matches", () => {
      const rule: Rule = {
        not: { kind: "headerPresent", name: "x-blocked" },
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-blocked": "yes" },
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });

    it("handles nested not (double negation)", () => {
      const rule: Rule = {
        not: { not: { kind: "headerPresent", name: "x-test" } },
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-test": "yes" },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("works with complex inner rule", () => {
      const rule: Rule = {
        not: {
          all: [
            { kind: "headerPresent", name: "x-bad" },
            { kind: "headerEquals", name: "server", value: "malware" },
          ],
        },
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: { "x-bad": "yes", server: "Apache" },
      };

      // x-bad is present but server is not "malware", so all() returns false
      // not(false) returns true
      expect(evalRule(rule, ctx)).toBe(true);
    });
  });

  describe("complex combinations", () => {
    it("handles all + any + not together", () => {
      const rule: Rule = {
        all: [
          { kind: "headerPresent", name: "x-required" },
          {
            any: [
              { kind: "headerEquals", name: "server", value: "vercel" },
              { kind: "headerEquals", name: "server", value: "netlify" },
            ],
          },
          {
            not: { kind: "headerPresent", name: "x-blocked" },
          },
        ],
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: {
          "x-required": "yes",
          server: "Vercel",
        },
      };

      expect(evalRule(rule, ctx)).toBe(true);
    });

    it("fails complex rule when not condition fails", () => {
      const rule: Rule = {
        all: [
          { kind: "headerPresent", name: "x-required" },
          {
            not: { kind: "headerPresent", name: "x-blocked" },
          },
        ],
      };
      const ctx: DetectionContext = {
        ...emptyContext,
        headers: {
          "x-required": "yes",
          "x-blocked": "yes",
        },
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });
  });

  describe("empty context handling", () => {
    it("handles completely empty context", () => {
      const rule: Rule = { kind: "headerPresent", name: "anything" };

      expect(evalRule(rule, emptyContext)).toBe(false);
    });

    it("handles context with only headers", () => {
      const rule: Rule = { kind: "mxSuffix", suffix: "google.com" };
      const ctx: DetectionContext = {
        headers: { server: "test" },
        mx: [],
        ns: [],
      };

      expect(evalRule(rule, ctx)).toBe(false);
    });
  });
});
