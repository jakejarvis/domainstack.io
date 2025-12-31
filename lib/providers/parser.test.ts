/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  getProvidersFromCatalog,
  parseProviderCatalog,
  safeParseProviderCatalog,
  toProvider,
} from "./parser";

describe("parseProviderCatalog", () => {
  it("parses a valid catalog", () => {
    const raw = {
      version: 1,
      ca: [
        {
          name: "Let's Encrypt",
          domain: "letsencrypt.org",
          rule: { kind: "issuerIncludes", substr: "let's encrypt" },
        },
      ],
      dns: [],
      email: [],
      hosting: [],
      registrar: [],
    };

    const catalog = parseProviderCatalog(raw);
    expect(catalog.version).toBe(1);
    expect(catalog.ca).toHaveLength(1);
    expect(catalog.ca[0].name).toBe("Let's Encrypt");
  });

  it("applies default empty arrays for missing categories", () => {
    const raw = { version: 1 };
    const catalog = parseProviderCatalog(raw);
    expect(catalog.ca).toEqual([]);
    expect(catalog.dns).toEqual([]);
    expect(catalog.email).toEqual([]);
    expect(catalog.hosting).toEqual([]);
    expect(catalog.registrar).toEqual([]);
  });

  it("throws on missing version", () => {
    const raw = {
      ca: [],
      dns: [],
      email: [],
      hosting: [],
      registrar: [],
    };

    expect(() => parseProviderCatalog(raw)).toThrow();
  });

  it("throws on invalid version type", () => {
    const raw = {
      version: "1",
      ca: [],
    };

    expect(() => parseProviderCatalog(raw)).toThrow();
  });

  it("throws on negative version", () => {
    const raw = {
      version: -1,
      ca: [],
    };

    expect(() => parseProviderCatalog(raw)).toThrow();
  });

  it("throws on missing provider name", () => {
    const raw = {
      version: 1,
      ca: [
        {
          domain: "example.com",
          rule: { kind: "issuerIncludes", substr: "test" },
        },
      ],
    };

    expect(() => parseProviderCatalog(raw)).toThrow();
  });

  it("throws on empty provider name", () => {
    const raw = {
      version: 1,
      ca: [
        {
          name: "",
          domain: "example.com",
          rule: { kind: "issuerIncludes", substr: "test" },
        },
      ],
    };

    expect(() => parseProviderCatalog(raw)).toThrow();
  });

  it("throws on invalid regex pattern", () => {
    const raw = {
      version: 1,
      dns: [
        {
          name: "Test Provider",
          domain: "test.com",
          rule: { kind: "nsRegex", pattern: "[invalid(regex" },
        },
      ],
    };

    expect(() => parseProviderCatalog(raw)).toThrow(/Invalid regex pattern/);
  });

  it("validates nested regex patterns in 'any' rules", () => {
    const raw = {
      version: 1,
      email: [
        {
          name: "Test Provider",
          domain: "test.com",
          rule: {
            any: [
              { kind: "mxSuffix", suffix: "valid.com" },
              { kind: "mxRegex", pattern: "[invalid(" },
            ],
          },
        },
      ],
    };

    expect(() => parseProviderCatalog(raw)).toThrow(/Invalid regex pattern/);
  });

  it("validates nested regex patterns in 'all' rules", () => {
    const raw = {
      version: 1,
      dns: [
        {
          name: "Test Provider",
          domain: "test.com",
          rule: {
            all: [
              { kind: "nsRegex", pattern: "^valid$" },
              { kind: "nsRegex", pattern: "**invalid" },
            ],
          },
        },
      ],
    };

    expect(() => parseProviderCatalog(raw)).toThrow(/Invalid regex pattern/);
  });

  it("parses valid regex patterns without error", () => {
    const raw = {
      version: 1,
      dns: [
        {
          name: "Amazon Route 53",
          domain: "aws.amazon.com",
          rule: {
            any: [
              {
                kind: "nsRegex",
                pattern: "^ns-\\d+\\.awsdns-\\d+\\.(com|net|org|co\\.uk)$",
                flags: "i",
              },
            ],
          },
        },
      ],
    };

    const catalog = parseProviderCatalog(raw);
    expect(catalog.dns).toHaveLength(1);
  });

  it("parses complex rule structures", () => {
    const raw = {
      version: 1,
      hosting: [
        {
          name: "Complex Provider",
          domain: "complex.com",
          rule: {
            all: [
              { kind: "headerEquals", name: "server", value: "nginx" },
              {
                any: [
                  { kind: "headerPresent", name: "x-custom-1" },
                  { kind: "headerPresent", name: "x-custom-2" },
                ],
              },
              {
                not: { kind: "headerIncludes", name: "via", substr: "proxy" },
              },
            ],
          },
        },
      ],
    };

    const catalog = parseProviderCatalog(raw);
    expect(catalog.hosting).toHaveLength(1);
  });
});

describe("safeParseProviderCatalog", () => {
  it("returns success for valid catalog", () => {
    const raw = { version: 1 };
    const result = safeParseProviderCatalog(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
    }
  });

  it("returns error for invalid catalog", () => {
    const raw = { ca: [] }; // missing version
    const result = safeParseProviderCatalog(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});

describe("toProvider", () => {
  it("converts catalog entry to full provider with category", () => {
    const entry = {
      name: "Test Provider",
      domain: "test.com",
      rule: { kind: "issuerIncludes" as const, substr: "test" },
    };

    const provider = toProvider(entry, "ca");
    expect(provider.name).toBe("Test Provider");
    expect(provider.domain).toBe("test.com");
    expect(provider.category).toBe("ca");
    expect(provider.rule).toEqual(entry.rule);
  });
});

describe("getProvidersFromCatalog", () => {
  it("extracts providers with correct category", () => {
    const catalog = {
      version: 1,
      ca: [
        {
          name: "CA Provider",
          domain: "ca.com",
          rule: { kind: "issuerIncludes" as const, substr: "test" },
        },
      ],
      dns: [
        {
          name: "DNS Provider",
          domain: "dns.com",
          rule: { kind: "nsSuffix" as const, suffix: "dns.com" },
        },
      ],
      email: [],
      hosting: [],
      registrar: [],
    };

    const caProviders = getProvidersFromCatalog(catalog, "ca");
    expect(caProviders).toHaveLength(1);
    expect(caProviders[0].name).toBe("CA Provider");
    expect(caProviders[0].category).toBe("ca");

    const dnsProviders = getProvidersFromCatalog(catalog, "dns");
    expect(dnsProviders).toHaveLength(1);
    expect(dnsProviders[0].name).toBe("DNS Provider");
    expect(dnsProviders[0].category).toBe("dns");

    const emailProviders = getProvidersFromCatalog(catalog, "email");
    expect(emailProviders).toHaveLength(0);
  });
});
