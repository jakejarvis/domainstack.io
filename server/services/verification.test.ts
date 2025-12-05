/* @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock fetchWithTimeoutAndRetry to use our mock
vi.mock("@/lib/fetch", () => ({
  fetchWithTimeoutAndRetry: vi.fn(
    async (url: string | URL, options?: RequestInit) => {
      return mockFetch(url.toString(), options);
    },
  ),
}));

import type { VerificationMethod } from "@/lib/db/repos/tracked-domains";
import {
  generateVerificationToken,
  getVerificationInstructions,
  tryAllVerificationMethods,
  verifyDomainOwnership,
} from "./verification";

afterEach(() => {
  mockFetch.mockReset();
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
    expect(result.hostname).toBe("_domainstack-verify.example.com");
    expect(result.recordType).toBe("TXT");
    expect(result.value).toBe(`domainstack-verify=${token}`);
    expect(result.suggestedTTL).toBe(3600);
    expect(result.suggestedTTLLabel).toBe("1 hour");
  });

  it("returns HTML file instructions with structured fields", () => {
    const result = getVerificationInstructions(
      "example.com",
      token,
      "html_file",
    );

    expect(result.title).toContain("HTML");
    expect(result.fullPath).toBe("/.well-known/domainstack-verify.txt");
    expect(result.filename).toBe("domainstack-verify.txt");
    expect(result.fileContent).toBe(token);
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
    });

    it("returns not verified when TXT record is missing", async () => {
      mockFetch.mockResolvedValueOnce({
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
    });

    it("returns not verified when TXT record value is wrong", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [
            {
              name: "_domainstack-verify.example.com.",
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
    });

    it("handles DNS query failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("DNS query failed");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("DNS resolution failed");
    });
  });

  describe("html_file method", () => {
    it("returns verified when file contains token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => token,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("html_file");
    });

    it("returns verified when token is in file with whitespace", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `  ${token}  \n`,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
    });

    it("falls back to HTTP when HTTPS fails", async () => {
      // HTTPS fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      // HTTP succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => token,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("returns not verified when file not found", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "html_file",
      );

      expect(result.verified).toBe(false);
    });

    it("returns not verified when file has wrong content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "wrongtoken",
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<html><head><meta content="${token}" name="domainstack-verify"></head></html>`,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
    });

    it("handles single quotes in meta tag", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<html><head><meta name='domainstack-verify' content='${token}'></head></html>`,
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
    });

    it("returns not verified when meta tag is missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          "<html><head><title>Test</title></head><body></body></html>",
      });

      const result = await verifyDomainOwnership(
        "example.com",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(false);
    });

    it("returns not verified when meta tag has wrong content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<html><head><meta name="domainstack-verify" content="wrongtoken"></head></html>',
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

    const result = await tryAllVerificationMethods("example.com", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("dns_txt");
    // Should only call DNS, not other methods
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to html_file when DNS fails", async () => {
    // DNS fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Status: 0, Answer: [] }),
    });
    // HTML succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => token,
    });

    const result = await tryAllVerificationMethods("example.com", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("html_file");
  });

  it("falls back to meta_tag when DNS and HTML fail", async () => {
    // DNS fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Status: 0, Answer: [] }),
    });
    // HTML HTTPS fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    // HTML HTTP fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    // Meta tag succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
    });

    const result = await tryAllVerificationMethods("example.com", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("meta_tag");
  });

  it("returns not verified when all methods fail", async () => {
    // DNS fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Status: 0, Answer: [] }),
    });
    // HTML fails (both protocols)
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await tryAllVerificationMethods("example.com", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
  });
});
