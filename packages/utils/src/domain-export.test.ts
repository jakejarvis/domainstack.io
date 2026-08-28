/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { DomainResponse } from "@domainstack/types";

import { serializeDomainExport } from "./domain-export";

describe("serializeDomainExport", () => {
  it("returns nulls for every section when given empty data", () => {
    const result = serializeDomainExport("example.com", {});
    expect(result).toEqual({
      domain: "example.com",
      registration: null,
      dns: null,
      hosting: null,
      certificates: null,
      headers: null,
      seo: null,
    });
  });

  it("strips internal and presentation-only fields from each section", () => {
    const fixture = {
      registration: {
        domain: "example.com",
        unicodeName: "example.com",
        punycodeName: "example.com",
        warnings: ["whois throttled"],
        registrarProvider: { id: "p_1", name: "Example Registrar", category: "registrar" },
        isRegistered: true,
        expirationDate: "2030-01-01",
      },
      dns: {
        records: [
          { type: "A", value: "1.2.3.4", ttl: 300, isCloudflare: true },
          { type: "MX", value: "mail.example.com", ttl: 600, isCloudflare: false },
        ],
        resolver: "1.1.1.1",
      },
      hosting: {
        dnsProvider: { id: "dp_1", name: "Cloudflare DNS" },
        hostingProvider: { id: "hp_1", name: "Vercel" },
        emailProvider: { id: "ep_1", name: "Google Workspace" },
        geo: { country: "US", city: "Ashburn" },
      },
      certificates: {
        certificates: [
          {
            issuer: "Let's Encrypt",
            validFrom: "2026-01-01",
            validTo: "2026-04-01",
            caProvider: { id: "ca_1", name: "Let's Encrypt" },
          },
        ],
      },
      headers: {
        status: 200,
        headers: { "content-type": "text/html" },
      },
      seo: {
        title: "Example",
        description: "A site",
        preview: "<html></html>",
        source: "html",
        errors: ["timeout"],
      },
    } as unknown as Partial<DomainResponse>;

    const result = serializeDomainExport("example.com", fixture);

    expect(result.domain).toBe("example.com");

    expect(result.registration).not.toHaveProperty("domain");
    expect(result.registration).not.toHaveProperty("unicodeName");
    expect(result.registration).not.toHaveProperty("punycodeName");
    expect(result.registration).not.toHaveProperty("warnings");
    expect(result.registration).not.toHaveProperty("registrarProvider");
    expect(result.registration).toMatchObject({ isRegistered: true, expirationDate: "2030-01-01" });

    expect(result.dns?.records?.[0]).not.toHaveProperty("isCloudflare");
    expect(result.dns?.records?.[0]).toMatchObject({ type: "A", value: "1.2.3.4" });
    expect(result.dns?.resolver).toBe("1.1.1.1");

    expect(result.hosting).toEqual({
      dns: "Cloudflare DNS",
      hosting: "Vercel",
      email: "Google Workspace",
      geo: { country: "US", city: "Ashburn" },
    });

    expect(result.certificates?.[0]).not.toHaveProperty("caProvider");
    expect(result.certificates?.[0]).toMatchObject({ issuer: "Let's Encrypt" });

    expect(result.headers).toEqual({ "content-type": "text/html" });

    expect(result.seo).not.toHaveProperty("preview");
    expect(result.seo).not.toHaveProperty("source");
    expect(result.seo).not.toHaveProperty("errors");
    expect(result.seo).toMatchObject({ title: "Example", description: "A site" });
  });
});
