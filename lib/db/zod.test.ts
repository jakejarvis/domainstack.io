import { describe, expect, it } from "vitest";
import { dnsRecordType } from "@/lib/db/schema";
import {
  DomainInsert,
  DomainSelect,
  SeoRowInsert,
  SeoRowSelect,
} from "@/lib/db/zod";
import { DnsTypeSchema } from "@/lib/schemas";

describe("drizzle-zod parity", () => {
  it("matches DNS enums with domain schemas", () => {
    expect(dnsRecordType.enumValues).toEqual(DnsTypeSchema.options);
  });

  it("coerces dates for insert but not for select", () => {
    const insertParsed = DomainInsert.parse({
      id: "29e3a9e4-2a4a-44b1-b430-9a5f9d6c0a25",
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(insertParsed.createdAt).toBeInstanceOf(Date);
    expect(insertParsed.updatedAt).toBeInstanceOf(Date);

    // Select schemas should remain Date, not string parsable
    expect(() =>
      DomainSelect.parse({
        id: "29e3a9e4-2a4a-44b1-b430-9a5f9d6c0a25",
        name: "example.com",
        tld: "com",
        unicodeName: "example.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("validates SEO JSON shapes using shared domain schemas", () => {
    const raw = {
      domainId: "29e3a9e4-2a4a-44b1-b430-9a5f9d6c0a25",
      sourceFinalUrl: null,
      sourceStatus: null,
      metaOpenGraph: { images: [] },
      metaTwitter: {},
      metaGeneral: {},
      previewTitle: null,
      previewDescription: null,
      previewImageUrl: null,
      previewImageUploadedUrl: null,
      canonicalUrl: null,
      robots: { fetched: false, groups: [], sitemaps: [] },
      robotsSitemaps: [],
      errors: [],
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };
    const insertRow = SeoRowInsert.parse(raw);
    // Select schema should reject string dates
    expect(() => SeoRowSelect.parse(raw)).toThrow();
    // But accept values already coerced by insert schema
    expect(() => SeoRowSelect.parse(insertRow)).not.toThrow();
  });
});
