/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { getProvidersFromCatalog, parseProviderCatalog } from "./parser";

describe("parseProviderCatalog", () => {
  it("parses a valid catalog", () => {
    const raw = {
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
    expect(catalog.ca).toHaveLength(1);
    expect(catalog.ca[0].name).toBe("Let's Encrypt");
  });

  it("applies default empty arrays for missing categories", () => {
    const raw = {};
    const catalog = parseProviderCatalog(raw);
    expect(catalog.ca).toEqual([]);
    expect(catalog.dns).toEqual([]);
    expect(catalog.email).toEqual([]);
    expect(catalog.hosting).toEqual([]);
    expect(catalog.registrar).toEqual([]);
  });

  it("throws on missing provider name", () => {
    const raw = {
      ca: [
        {
          domain: "test.invalid",
          rule: { kind: "issuerIncludes", substr: "test" },
        },
      ],
    };

    expect(() => parseProviderCatalog(raw)).toThrow();
  });

  it("throws on empty provider name", () => {
    const raw = {
      ca: [
        {
          name: "",
          domain: "test.invalid",
          rule: { kind: "issuerIncludes", substr: "test" },
        },
      ],
    };

    expect(() => parseProviderCatalog(raw)).toThrow();
  });

  it("throws on invalid regex pattern", () => {
    const raw = {
      dns: [
        {
          name: "Test Provider",
          domain: "test.invalid",
          rule: { kind: "nsRegex", pattern: "[invalid(regex" },
        },
      ],
    };

    expect(() => parseProviderCatalog(raw)).toThrow(/Invalid regex pattern/);
  });

  it("validates nested regex patterns in 'any' rules", () => {
    const raw = {
      email: [
        {
          name: "Test Provider",
          domain: "test.invalid",
          rule: {
            any: [
              { kind: "mxSuffix", suffix: "valid.invalid" },
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
      dns: [
        {
          name: "Test Provider",
          domain: "test.invalid",
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

describe("getProvidersFromCatalog", () => {
  it("extracts providers with correct category", () => {
    const catalog = {
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
