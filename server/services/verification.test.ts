/* @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to make mock hoisting explicit for ESM modules
const mockFetch = vi.hoisted(() => vi.fn());
const mockFetchRemoteAsset = vi.hoisted(() => vi.fn());

vi.mock("@/lib/fetch", () => ({
  fetchWithTimeoutAndRetry: vi.fn(
    async (url: string | URL, options?: RequestInit) => {
      return mockFetch(url.toString(), options);
    },
  ),
}));

// Mock fetchRemoteAsset for HTML file and meta tag verification (SSRF-protected)
vi.mock("@/lib/fetch-remote-asset", () => ({
  fetchRemoteAsset: vi.fn(async (opts: { url: string | URL }) => {
    return mockFetchRemoteAsset(opts.url.toString());
  }),
  RemoteAssetError: class RemoteAssetError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "RemoteAssetError";
    }
  },
}));

// Mock fetch globally for DNS queries
vi.stubGlobal("fetch", mockFetch);

import type { VerificationMethod } from "@/lib/db/repos/tracked-domains";
import {
  generateVerificationToken,
  getVerificationInstructions,
  tryAllVerificationMethods,
  verifyDomainOwnership,
} from "./verification";

afterEach(() => {
  mockFetch.mockReset();
  mockFetchRemoteAsset.mockReset();
});

describe("generateVerificationToken", () => {
  it("generates a 32-character hex string", () => {
    const token = generateVerificationToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique tokens", () => {
    const token1 = generateVerificationToken();
    const token2 = generateVerificationToken();
    const token3 = generateVerificationToken();

    expect(token1).not.toBe(token2);
    expect(token2).not.toBe(token3);
    expect(token1).not.toBe(token3);
  });
});

describe("getVerificationInstructions", () => {
  const token = "abc123def456";

  it("returns DNS TXT instructions with structured fields", () => {
    const result = getVerificationInstructions("example.com", token, "dns_txt");

    expect(result.title).toContain("DNS");
    expect(result.hostname).toBe("example.com");
    expect(result.value).toBe(`domainstack-verify=${token}`);
  });

  it("returns HTML file instructions with structured fields", () => {
    const result = getVerificationInstructions(
      "example.com",
      token,
      "html_file",
    );

    expect(result.title).toContain("HTML");
    expect(result.fullPath).toBe(
      `/.well-known/domainstack-verify/${token}.html`,
    );
    expect(result.filename).toBe(`${token}.html`);
    expect(result.fileContent).toBe(`domainstack-verify: ${token}`);
  });

  it("returns meta tag instructions with structured fields", () => {
    const result = getVerificationInstructions(
      "example.com",
      token,
      "meta_tag",
    );

    expect(result.title).toContain("Meta");
    expect(result.metaTag).toContain("<meta");
    expect(result.metaTag).toContain('name="domainstack-verify"');
    expect(result.metaTag).toContain(`content="${token}"`);
  });
});

describe("verifyDomainOwnership", () => {
  const token = "testtoken123";

  describe("dns_txt method", () => {
    it("returns verified when TXT record matches", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [
            {
              name: "example.com.",
              type: 16,
              TTL: 300,
              data: `"domainstack-verify=${token}"`,
            },
          ],
        }),
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("dns_txt");
    });

    it("returns verified when TXT record matches on legacy subdomain", async () => {
      // Apex domain (first provider) returns no records
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [],
        }),
      });
      // Apex domain (second provider) returns no records
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [],
        }),
      });
      // Legacy subdomain (first provider) returns matching record
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [
            {
              name: "_domainstack-verify.example.com.",
              type: 16,
              TTL: 300,
              data: `"domainstack-verify=${token}"`,
            },
          ],
        }),
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("dns_txt");
      // Should try apex domain with both providers, then legacy subdomain with first provider
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("returns not verified when TXT record is missing", async () => {
      // Both providers return no records
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [],
        }),
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(false);
      expect(result.method).toBeNull();
      // Should try both hostnames (apex + legacy) × both providers = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("returns not verified when TXT record value is wrong", async () => {
      // Both providers return wrong token
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [
            {
              name: "example.com.",
              type: 16,
              TTL: 300,
              data: '"domainstack-verify=wrongtoken"',
            },
          ],
        }),
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(false);
      // Should try both hostnames (apex + legacy) × both providers = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("handles DNS query failure", async () => {
      // Mock both providers failing
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(false);
      // Error is not set when all providers fail (method returns null)
    });

    it("handles network error", async () => {
      // Mock all providers failing with network error
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(false);
      // verifyDnsTxt catches all errors and returns { verified: false, method: null }
      // without propagating the error (this is expected behavior - fail gracefully after trying all providers)
      expect(result.method).toBeNull();
    });
  });

  describe("html_file method", () => {
    const expectedContent = `domainstack-verify: ${token}`;

    it("returns verified when per-token file contains correct content", async () => {
      // Per-token file found with correct content format
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(expectedContent),
        contentType: "text/html",
        finalUrl: `https://example.com/.well-known/domainstack-verify/${token}.html`,
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("html_file");
    });

    it("returns verified when per-token file has content with whitespace", async () => {
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(`  ${expectedContent}  \n`),
        contentType: "text/html",
        finalUrl: `https://example.com/.well-known/domainstack-verify/${token}.html`,
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
    });

    it("returns not verified when per-token file is empty", async () => {
      // Empty file is not valid - must contain the token
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(""),
        contentType: "text/html",
        finalUrl: `https://example.com/.well-known/domainstack-verify/${token}.html`,
        status: 200,
      });
      // Per-token HTTP also empty
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(""),
        contentType: "text/html",
        finalUrl: `http://example.com/.well-known/domainstack-verify/${token}.html`,
        status: 200,
      });
      // Legacy files also empty
      mockFetchRemoteAsset.mockResolvedValue({
        buffer: Buffer.from(""),
        contentType: "text/html",
        finalUrl: "https://example.com/.well-known/domainstack-verify.html",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(false);
    });

    it("falls back to legacy file when per-token files not found", async () => {
      // Per-token HTTPS fails
      mockFetchRemoteAsset.mockRejectedValueOnce(
        new Error("Response error: 404"),
      );
      // Per-token HTTP fails
      mockFetchRemoteAsset.mockRejectedValueOnce(
        new Error("Response error: 404"),
      );
      // Legacy HTTPS succeeds
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(expectedContent),
        contentType: "text/html",
        finalUrl: "https://example.com/.well-known/domainstack-verify.html",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
      expect(mockFetchRemoteAsset).toHaveBeenCalledTimes(3);
    });

    it("falls back to HTTP when HTTPS fails for per-token file", async () => {
      // Per-token HTTPS fails
      mockFetchRemoteAsset.mockRejectedValueOnce(
        new Error("Response error: 404"),
      );
      // Per-token HTTP succeeds
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(expectedContent),
        contentType: "text/html",
        finalUrl: `http://example.com/.well-known/domainstack-verify/${token}.html`,
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
      expect(mockFetchRemoteAsset).toHaveBeenCalledTimes(2);
    });

    it("returns not verified when all files not found", async () => {
      // All URLs fail (per-token HTTPS, per-token HTTP, legacy HTTPS, legacy HTTP)
      mockFetchRemoteAsset.mockRejectedValue(new Error("Response error: 404"));

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(false);
      // Should try 4 URLs: per-token HTTPS, per-token HTTP, legacy HTTPS, legacy HTTP
      expect(mockFetchRemoteAsset).toHaveBeenCalledTimes(4);
    });

    it("returns not verified when per-token file has wrong content", async () => {
      // Per-token file exists but has different content (not empty, not matching token)
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from("wrongtoken"),
        contentType: "text/html",
        finalUrl: `https://example.com/.well-known/domainstack-verify/${token}.html`,
        status: 200,
      });
      // Per-token HTTP also has wrong content
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from("wrongtoken"),
        contentType: "text/html",
        finalUrl: `http://example.com/.well-known/domainstack-verify/${token}.html`,
        status: 200,
      });
      // Legacy files also have wrong content
      mockFetchRemoteAsset.mockResolvedValue({
        buffer: Buffer.from("wrongtoken"),
        contentType: "text/html",
        finalUrl: "https://example.com/.well-known/domainstack-verify.html",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(false);
    });
  });

  describe("meta_tag method", () => {
    it("returns verified when meta tag with correct content exists", async () => {
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(
          `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
        ),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("meta_tag");
    });

    it("handles meta tag with reversed attribute order", async () => {
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(
          `<html><head><meta content="${token}" name="domainstack-verify"></head></html>`,
        ),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
    });

    it("handles single quotes in meta tag", async () => {
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(
          `<html><head><meta name='domainstack-verify' content='${token}'></head></html>`,
        ),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
    });

    it("finds correct token among multiple verification meta tags", async () => {
      // Multiple users can track the same domain, so there may be multiple meta tags
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(
          `<html><head>
            <meta name="domainstack-verify" content="otheruser1token">
            <meta name="domainstack-verify" content="${token}">
            <meta name="domainstack-verify" content="otheruser2token">
          </head></html>`,
        ),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("meta_tag");
    });

    it("returns not verified when token not in any of multiple meta tags", async () => {
      // Multiple verification tags exist, but none match our token
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(
          `<html><head>
            <meta name="domainstack-verify" content="otheruser1token">
            <meta name="domainstack-verify" content="otheruser2token">
          </head></html>`,
        ),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(false);
    });

    it("handles malformed HTML gracefully", async () => {
      // Cheerio is more tolerant of malformed HTML than regex
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(
          `<html><head>
            <meta name="domainstack-verify" content="${token}"
            <meta name="description" content="test">
          </head></html>`,
        ),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      // Cheerio should still parse this
      expect(result.verified).toBe(true);
    });

    it("returns not verified when meta tag is missing", async () => {
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(
          "<html><head><title>Test</title></head><body></body></html>",
        ),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(false);
    });

    it("returns not verified when meta tag has wrong content", async () => {
      mockFetchRemoteAsset.mockResolvedValueOnce({
        buffer: Buffer.from(
          '<html><head><meta name="domainstack-verify" content="wrongtoken"></head></html>',
        ),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(false);
    });
  });

  describe("unknown method", () => {
    it("returns error for unknown method", async () => {
      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "unknown" as unknown as VerificationMethod,
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Unknown method");
    });
  });
});

describe("tryAllVerificationMethods", () => {
  const token = "testtoken123";

  it("returns dns_txt when DNS verification succeeds first", async () => {
    // First provider succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Status: 0,
        Answer: [
          {
            name: "example.com.",
            type: 16,
            TTL: 300,
            data: `"domainstack-verify=${token}"`,
          },
        ],
      }),
    });

    const result = await tryAllVerificationMethods("example.com", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("dns_txt");
    // Should only call first DNS provider
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to html_file when DNS fails", async () => {
    // DNS providers fail (no matching TXT records) - 2 hostnames × 2 providers = 4 calls
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Status: 0, Answer: [] }),
    });
    // HTML per-token file succeeds via fetchRemoteAsset
    mockFetchRemoteAsset.mockResolvedValueOnce({
      buffer: Buffer.from(`domainstack-verify: ${token}`),
      contentType: "text/html",
      finalUrl: `https://example.com/.well-known/domainstack-verify/${token}.html`,
      status: 200,
    });

    const result = await tryAllVerificationMethods("example.com", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("html_file");
    // Should try DNS with both hostnames × both providers = 4 calls
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("falls back to meta_tag when DNS and HTML fail", async () => {
    // DNS providers fail - 2 hostnames × 2 providers = 4 calls
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Status: 0, Answer: [] }),
    });
    // HTML per-token HTTPS fails
    mockFetchRemoteAsset.mockRejectedValueOnce(
      new Error("Response error: 404"),
    );
    // HTML per-token HTTP fails
    mockFetchRemoteAsset.mockRejectedValueOnce(
      new Error("Response error: 404"),
    );
    // HTML legacy HTTPS fails
    mockFetchRemoteAsset.mockRejectedValueOnce(
      new Error("Response error: 404"),
    );
    // HTML legacy HTTP fails
    mockFetchRemoteAsset.mockRejectedValueOnce(
      new Error("Response error: 404"),
    );
    // Meta tag succeeds via fetchRemoteAsset
    mockFetchRemoteAsset.mockResolvedValueOnce({
      buffer: Buffer.from(
        `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
      ),
      contentType: "text/html",
      finalUrl: "https://example.com/",
      status: 200,
    });

    const result = await tryAllVerificationMethods("example.com", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("meta_tag");
    // Should try DNS with both hostnames × both providers = 4 calls
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("returns not verified when all methods fail", async () => {
    // DNS providers fail - 2 hostnames × 2 providers = 4 calls
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Status: 0, Answer: [] }),
    });
    // HTML fails (both protocols) via fetchRemoteAsset
    mockFetchRemoteAsset.mockRejectedValue(new Error("Response error: 404"));

    const result = await tryAllVerificationMethods("example.com", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
    // Should try DNS with both hostnames × both providers = 4 calls
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
