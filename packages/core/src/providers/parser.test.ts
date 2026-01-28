/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  getProvidersFromCatalog,
  parseProviderCatalog,
  safeParseProviderCatalog,
} from "./parser";

describe("parseProviderCatalog", () => {
  it("parses a valid minimal catalog", () => {
    const catalog = parseProviderCatalog({});

    expect(catalog.hosting).toEqual([]);
    expect(catalog.email).toEqual([]);
    expect(catalog.dns).toEqual([]);
    expect(catalog.registrar).toEqual([]);
    expect(catalog.ca).toEqual([]);
  });

  it("parses a catalog with providers", () => {
    const catalog = parseProviderCatalog({
      hosting: [
        {
          name: "Vercel",
          domain: "vercel.com",
          rule: { kind: "headerPresent", name: "x-vercel-id" },
        },
      ],
    });

    expect(catalog.hosting).toHaveLength(1);
    expect(catalog.hosting[0]?.name).toBe("Vercel");
  });

  it("rejects provider with empty name", () => {
    expect(() =>
      parseProviderCatalog({
        hosting: [
          {
            name: "",
            domain: "example.com",
            rule: { kind: "headerPresent", name: "x-test" },
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects provider with empty domain", () => {
    expect(() =>
      parseProviderCatalog({
        hosting: [
          {
            name: "Test",
            domain: "",
            rule: { kind: "headerPresent", name: "x-test" },
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects null input", () => {
    expect(() => parseProviderCatalog(null)).toThrow();
  });

  it("rejects array input", () => {
    expect(() => parseProviderCatalog([])).toThrow();
  });

  it("rejects string input", () => {
    expect(() => parseProviderCatalog("not an object")).toThrow();
  });

  it("rejects invalid regex pattern at parse time", () => {
    expect(() =>
      parseProviderCatalog({
        email: [
          {
            name: "Bad Regex Provider",
            domain: "example.com",
            rule: { kind: "mxRegex", pattern: "[invalid(" },
          },
        ],
      }),
    ).toThrow(/Invalid regex pattern/);
  });

  it("rejects invalid nsRegex pattern at parse time", () => {
    expect(() =>
      parseProviderCatalog({
        dns: [
          {
            name: "Bad NS Regex",
            domain: "example.com",
            rule: { kind: "nsRegex", pattern: "**invalid**" },
          },
        ],
      }),
    ).toThrow(/Invalid regex pattern/);
  });

  it("validates nested regex in 'all' combinator", () => {
    expect(() =>
      parseProviderCatalog({
        hosting: [
          {
            name: "Nested Bad Regex",
            domain: "example.com",
            rule: {
              all: [
                { kind: "headerPresent", name: "x-test" },
                { kind: "mxRegex", pattern: "[[[" },
              ],
            },
          },
        ],
      }),
    ).toThrow(/Invalid regex pattern/);
  });

  it("validates nested regex in 'any' combinator", () => {
    expect(() =>
      parseProviderCatalog({
        hosting: [
          {
            name: "Nested Any Bad Regex",
            domain: "example.com",
            rule: {
              any: [{ kind: "nsRegex", pattern: "(unclosed" }],
            },
          },
        ],
      }),
    ).toThrow(/Invalid regex pattern/);
  });

  it("validates deeply nested regex in 'not' combinator", () => {
    expect(() =>
      parseProviderCatalog({
        hosting: [
          {
            name: "Nested Not Bad Regex",
            domain: "example.com",
            rule: {
              not: { kind: "mxRegex", pattern: "++" },
            },
          },
        ],
      }),
    ).toThrow(/Invalid regex pattern/);
  });

  it("accepts valid regex patterns", () => {
    const catalog = parseProviderCatalog({
      dns: [
        {
          name: "Route 53",
          domain: "aws.amazon.com",
          rule: {
            kind: "nsRegex",
            pattern: "^ns-\\d+\\.awsdns-\\d+\\.(com|net|org)$",
            flags: "i",
          },
        },
      ],
      email: [
        {
          name: "Google",
          domain: "google.com",
          rule: { kind: "mxRegex", pattern: "google\\.com$" },
        },
      ],
    });

    expect(catalog.dns).toHaveLength(1);
    expect(catalog.email).toHaveLength(1);
  });
});

describe("safeParseProviderCatalog", () => {
  it("returns success for valid catalog", () => {
    const result = safeParseProviderCatalog({
      hosting: [
        {
          name: "Vercel",
          domain: "vercel.com",
          rule: { kind: "headerPresent", name: "x-vercel-id" },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hosting).toHaveLength(1);
    }
  });

  it("returns error for invalid catalog", () => {
    const result = safeParseProviderCatalog(null);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns error object for empty name", () => {
    const result = safeParseProviderCatalog({
      hosting: [
        {
          name: "",
          domain: "example.com",
          rule: { kind: "headerPresent", name: "x-test" },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("returns error object for invalid regex", () => {
    const result = safeParseProviderCatalog({
      email: [
        {
          name: "Bad",
          domain: "example.com",
          rule: { kind: "mxRegex", pattern: "[invalid(" },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("Invalid regex")),
      ).toBe(true);
    }
  });
});

describe("getProvidersFromCatalog", () => {
  const catalog = {
    hosting: [
      {
        name: "Vercel",
        domain: "vercel.com",
        rule: { kind: "headerPresent" as const, name: "x-vercel-id" },
      },
      {
        name: "Netlify",
        domain: "netlify.com",
        rule: { kind: "headerPresent" as const, name: "x-nf-request-id" },
      },
    ],
    email: [
      {
        name: "Google",
        domain: "google.com",
        rule: { kind: "mxSuffix" as const, suffix: "google.com" },
      },
    ],
    dns: [],
    registrar: [],
    ca: [],
  };

  it("extracts providers for specified category", () => {
    const hostingProviders = getProvidersFromCatalog(catalog, "hosting");

    expect(hostingProviders).toHaveLength(2);
    expect(hostingProviders[0]?.name).toBe("Vercel");
    expect(hostingProviders[0]?.category).toBe("hosting");
    expect(hostingProviders[1]?.name).toBe("Netlify");
    expect(hostingProviders[1]?.category).toBe("hosting");
  });

  it("returns empty array for empty category", () => {
    const dnsProviders = getProvidersFromCatalog(catalog, "dns");

    expect(dnsProviders).toEqual([]);
  });

  it("adds category to each provider entry", () => {
    const emailProviders = getProvidersFromCatalog(catalog, "email");

    expect(emailProviders).toHaveLength(1);
    expect(emailProviders[0]?.category).toBe("email");
  });

  it("preserves original entry properties", () => {
    const providers = getProvidersFromCatalog(catalog, "hosting");
    const vercel = providers.find((p) => p.name === "Vercel");

    expect(vercel).toBeDefined();
    expect(vercel?.domain).toBe("vercel.com");
    expect(vercel?.rule).toEqual({
      kind: "headerPresent",
      name: "x-vercel-id",
    });
  });
});
