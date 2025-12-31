/* @vitest-environment node */
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VerificationMethod } from "@/lib/db/repos/tracked-domains";
import { server } from "@/mocks/server";
import {
  generateVerificationToken,
  getVerificationInstructions,
  tryAllVerificationMethods,
  verifyDomainOwnership,
} from "./verification";

// We don't mock fetch/fetchRemoteAsset anymore - we let them run and hit MSW

afterEach(() => {
  vi.restoreAllMocks();
  server.resetHandlers();
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
    const result = getVerificationInstructions(
      "verified-dns.test",
      token,
      "dns_txt",
    );

    expect(result.title).toContain("DNS");
    expect(result.hostname).toBe("verified-dns.test");
    expect(result.value).toBe(`domainstack-verify=${token}`);
  });

  it("returns HTML file instructions with structured fields", () => {
    const result = getVerificationInstructions(
      "verified-dns.test",
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
      "verified-dns.test",
      token,
      "meta_tag",
    );

    expect(result.title).toContain("meta tag");
    expect(result.metaTag).toContain("<meta");
    expect(result.metaTag).toContain('name="domainstack-verify"');
    expect(result.metaTag).toContain(`content="${token}"`);
  });
});

describe("verifyDomainOwnership", () => {
  const token = "testtoken123";

  describe("dns_txt method", () => {
    it("returns verified when TXT record matches", async () => {
      // Mock DoH response for TXT record
      const dohHandler = () => {
        return HttpResponse.json({
          Status: 0,
          Answer: [
            {
              name: "verified-dns.test.",
              type: 16,
              TTL: 300,
              data: `"domainstack-verify=${token}"`,
            },
          ],
        });
      };

      server.use(
        http.get("https://cloudflare-dns.com/dns-query", dohHandler),
        http.get("https://dns.google/resolve", dohHandler),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("dns_txt");
    });

    it("returns verified when TXT record matches on legacy subdomain", async () => {
      // Mock DoH response:
      // 1. Apex domain -> No TXT
      // 2. Legacy subdomain -> TXT match
      const dohHandler = ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("name");

        if (name === "verified-dns.test") {
          return HttpResponse.json({
            Status: 0,
            Answer: [],
          });
        }

        if (name === "_domainstack-verify.verified-dns.test") {
          return HttpResponse.json({
            Status: 0,
            Answer: [
              {
                name: "_domainstack-verify.verified-dns.test.",
                type: 16,
                TTL: 300,
                data: `"domainstack-verify=${token}"`,
              },
            ],
          });
        }

        return HttpResponse.json({ Status: 0, Answer: [] });
      };

      server.use(
        http.get("https://cloudflare-dns.com/dns-query", dohHandler),
        http.get("https://dns.google/resolve", dohHandler),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("dns_txt");
    });

    it("returns not verified when TXT record is missing", async () => {
      // Default handler in mocks/handlers.ts for verified-dns.test TXT is "v=spf1" (no match)
      // We can use that or explicitly mock empty
      const dohHandler = () => {
        return HttpResponse.json({
          Status: 0,
          Answer: [], // No records
        });
      };

      server.use(
        http.get("https://cloudflare-dns.com/dns-query", dohHandler),
        http.get("https://dns.google/resolve", dohHandler),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(false);
      expect(result.method).toBeNull();
    });

    it("returns not verified when TXT record value is wrong", async () => {
      const dohHandler = () => {
        return HttpResponse.json({
          Status: 0,
          Answer: [
            {
              name: "verified-dns.test.",
              type: 16,
              TTL: 300,
              data: '"domainstack-verify=wrongtoken"',
            },
          ],
        });
      };

      server.use(
        http.get("https://cloudflare-dns.com/dns-query", dohHandler),
        http.get("https://dns.google/resolve", dohHandler),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(false);
    });

    it("handles DNS query failure", async () => {
      // Mock provider failure
      server.use(
        http.get("https://cloudflare-dns.com/dns-query", () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get("https://dns.google/resolve", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "dns_txt",
      );

      expect(result.verified).toBe(false);
    });
  });

  describe("html_file method", () => {
    const expectedContent = `domainstack-verify: ${token}`;

    it("returns verified when per-token file contains correct content", async () => {
      // Mock the per-token file
      server.use(
        http.get(
          `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
          () => {
            return new HttpResponse(expectedContent, {
              headers: { "Content-Type": "text/html" },
            });
          },
        ),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("html_file");
    });

    it("returns verified when per-token file has content with whitespace", async () => {
      server.use(
        http.get(
          `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
          () => {
            return new HttpResponse(`  ${expectedContent}  \n`, {
              headers: { "Content-Type": "text/html" },
            });
          },
        ),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
    });

    it("returns not verified when per-token file is empty", async () => {
      server.use(
        http.get(
          `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
          () => {
            return new HttpResponse("", {
              headers: { "Content-Type": "text/html" },
            });
          },
        ),
        // Legacy file also empty or 404
        http.get(
          "https://verified-dns.test/.well-known/domainstack-verify.html",
          () => new HttpResponse(null, { status: 404 }),
        ),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "html_file",
      );

      expect(result.verified).toBe(false);
    });

    it("falls back to legacy file when per-token files not found", async () => {
      server.use(
        // Per-token 404
        http.get(
          `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
          () => new HttpResponse(null, { status: 404 }),
        ),
        http.get(
          `http://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
          () => new HttpResponse(null, { status: 404 }),
        ),
        // Legacy found
        http.get(
          "https://verified-dns.test/.well-known/domainstack-verify.html",
          () => {
            return new HttpResponse(expectedContent, {
              headers: { "Content-Type": "text/html" },
            });
          },
        ),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
    });

    it("falls back to HTTP when HTTPS fails for per-token file", async () => {
      server.use(
        // HTTPS 404
        http.get(
          `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
          () => new HttpResponse(null, { status: 404 }),
        ),
        // HTTP found
        http.get(
          `http://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
          () => {
            return new HttpResponse(expectedContent, {
              headers: { "Content-Type": "text/html" },
            });
          },
        ),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "html_file",
      );

      expect(result.verified).toBe(true);
    });

    it("returns not verified when all files not found", async () => {
      server.use(
        http.get("https://verified-dns.test/*", () => {
          return new HttpResponse(null, { status: 404 });
        }),
        http.get("http://verified-dns.test/*", () => {
          return new HttpResponse(null, { status: 404 });
        }),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "html_file",
      );

      expect(result.verified).toBe(false);
    });
  });

  describe("meta_tag method", () => {
    it("returns verified when meta tag with correct content exists", async () => {
      server.use(
        http.get("https://verified-dns.test/", () => {
          return new HttpResponse(
            `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          );
        }),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
      expect(result.method).toBe("meta_tag");
    });

    it("handles meta tag with reversed attribute order", async () => {
      server.use(
        http.get("https://verified-dns.test/", () => {
          return new HttpResponse(
            `<html><head><meta content="${token}" name="domainstack-verify"></head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          );
        }),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
    });

    it("finds correct token among multiple verification meta tags", async () => {
      server.use(
        http.get("https://verified-dns.test/", () => {
          return new HttpResponse(
            `<html><head>
              <meta name="domainstack-verify" content="otheruser1token">
              <meta name="domainstack-verify" content="${token}">
              <meta name="domainstack-verify" content="otheruser2token">
            </head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          );
        }),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
    });

    it("returns not verified when token not in any of multiple meta tags", async () => {
      server.use(
        http.get("https://verified-dns.test/", () => {
          return new HttpResponse(
            `<html><head>
              <meta name="domainstack-verify" content="otheruser1token">
              <meta name="domainstack-verify" content="otheruser2token">
            </head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          );
        }),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(false);
    });

    it("handles malformed HTML gracefully", async () => {
      server.use(
        http.get("https://verified-dns.test/", () => {
          return new HttpResponse(
            `<html><head>
              <meta name="domainstack-verify" content="${token}"
              <meta name="description" content="test">
            </head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          );
        }),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(true);
    });

    it("returns not verified when meta tag is missing", async () => {
      server.use(
        http.get("https://verified-dns.test/", () => {
          return new HttpResponse(
            "<html><head><title>Test</title></head><body></body></html>",
            {
              headers: { "Content-Type": "text/html" },
            },
          );
        }),
      );

      const result = await verifyDomainOwnership(
        "verified-dns.test",
        token,
        "meta_tag",
      );

      expect(result.verified).toBe(false);
    });
  });

  describe("unknown method", () => {
    it("returns error for unknown method", async () => {
      const result = await verifyDomainOwnership(
        "verified-dns.test",
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
    const dohHandler = () => {
      return HttpResponse.json({
        Status: 0,
        Answer: [
          {
            name: "verified-dns.test.",
            type: 16,
            TTL: 300,
            data: `"domainstack-verify=${token}"`,
          },
        ],
      });
    };

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohHandler),
      http.get("https://dns.google/resolve", dohHandler),
    );

    const result = await tryAllVerificationMethods("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("dns_txt");
  });

  it("falls back to html_file when DNS fails", async () => {
    // DNS fails for TXT only, but succeeds for A (needed for fetch)
    const dohFailTxtHandler = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      const type = url.searchParams.get("type");

      if (type === "TXT") {
        return HttpResponse.json({ Status: 0, Answer: [] });
      }

      // Return A record for verified-dns.test to allow fetching
      if (type === "A") {
        return HttpResponse.json({
          Status: 0,
          Answer: [
            {
              name: "verified-dns.test.",
              type: 1,
              TTL: 60,
              data: "1.2.3.4",
            },
          ],
        });
      }

      return HttpResponse.json({ Status: 0, Answer: [] });
    };

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohFailTxtHandler),
      http.get("https://dns.google/resolve", dohFailTxtHandler),
    );

    // HTML succeeds
    server.use(
      http.get(
        `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () => {
          return new HttpResponse(`domainstack-verify: ${token}`, {
            headers: { "Content-Type": "text/html" },
          });
        },
      ),
    );

    const result = await tryAllVerificationMethods("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("html_file");
  });

  it("falls back to meta_tag when DNS and HTML fail", async () => {
    // DNS fails for TXT only
    const dohFailTxtHandler = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      const type = url.searchParams.get("type");

      if (type === "TXT") {
        return HttpResponse.json({ Status: 0, Answer: [] });
      }

      if (type === "A") {
        return HttpResponse.json({
          Status: 0,
          Answer: [
            {
              name: "verified-dns.test.",
              type: 1,
              TTL: 60,
              data: "1.2.3.4",
            },
          ],
        });
      }

      return HttpResponse.json({ Status: 0, Answer: [] });
    };

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohFailTxtHandler),
      http.get("https://dns.google/resolve", dohFailTxtHandler),
    );

    // HTML fails
    server.use(
      http.get("https://verified-dns.test/.well-known/*", () =>
        HttpResponse.json(null, { status: 404 }),
      ),
      http.get("http://verified-dns.test/.well-known/*", () =>
        HttpResponse.json(null, { status: 404 }),
      ),
    );

    // Meta succeeds
    server.use(
      http.get("https://verified-dns.test/", () => {
        return new HttpResponse(
          `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
          {
            headers: { "Content-Type": "text/html" },
          },
        );
      }),
    );

    const result = await tryAllVerificationMethods("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("meta_tag");
  });

  it("returns not verified when all methods fail", async () => {
    // All fail (TXT fails, A succeeds to allow trying HTML/Meta, but those fail too)
    const dohFailTxtHandler = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      const type = url.searchParams.get("type");

      if (type === "TXT") {
        return HttpResponse.json({ Status: 0, Answer: [] });
      }

      if (type === "A") {
        return HttpResponse.json({
          Status: 0,
          Answer: [
            {
              name: "verified-dns.test.",
              type: 1,
              TTL: 60,
              data: "1.2.3.4",
            },
          ],
        });
      }

      return HttpResponse.json({ Status: 0, Answer: [] });
    };

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohFailTxtHandler),
      http.get("https://dns.google/resolve", dohFailTxtHandler),
    );

    server.use(
      http.get("https://verified-dns.test/*", () =>
        HttpResponse.json(null, { status: 404 }),
      ),
      http.get("http://verified-dns.test/*", () =>
        HttpResponse.json(null, { status: 404 }),
      ),
    );

    const result = await tryAllVerificationMethods("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
  });
});
