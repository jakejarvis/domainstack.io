import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { server } from "./test-setup";

type MockDnsLookup = (hostname: string) => Promise<Array<{ address: string; family: 4 }>>;

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn<MockDnsLookup>(async (hostname: string) => {
    if (hostname.endsWith(".test")) {
      return [{ address: "1.2.3.4", family: 4 }];
    }
    throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
      code: "ENOTFOUND",
    });
  }),
}));

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("verifyByDns", () => {
  const token = "testtoken123";

  it("returns verified when TXT record matches", async () => {
    const dohHandler = () =>
      HttpResponse.json({
        Status: 0,
        Answer: [
          {
            name: "verified-dns.test.",
            type: 16,
            TTL: 300,
            data: `"domainstack-verification=${token}"`,
          },
        ],
      });

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohHandler),
      http.get("https://dns.google/resolve", dohHandler),
    );

    const { verifyByDns } = await import("./index");
    const result = await verifyByDns("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("dns_txt");
  });

  it("returns verified when TXT record matches the legacy value prefix", async () => {
    const dohHandler = () =>
      HttpResponse.json({
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

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohHandler),
      http.get("https://dns.google/resolve", dohHandler),
    );

    const { verifyByDns } = await import("./index");
    const result = await verifyByDns("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("dns_txt");
  });

  it("returns verified when TXT record matches on legacy subdomain", async () => {
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
              data: `"domainstack-verification=${token}"`,
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

    const { verifyByDns } = await import("./index");
    const result = await verifyByDns("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("dns_txt");
  });

  it("returns not verified when TXT record is missing", async () => {
    const dohHandler = () =>
      HttpResponse.json({
        Status: 0,
        Answer: [],
      });

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohHandler),
      http.get("https://dns.google/resolve", dohHandler),
    );

    const { verifyByDns } = await import("./index");
    const result = await verifyByDns("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
  });

  it("returns not verified when TXT record value is wrong", async () => {
    const dohHandler = () =>
      HttpResponse.json({
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

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohHandler),
      http.get("https://dns.google/resolve", dohHandler),
    );

    const { verifyByDns } = await import("./index");
    const result = await verifyByDns("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
  });

  it("handles DNS query failure gracefully", async () => {
    server.use(
      http.get(
        "https://cloudflare-dns.com/dns-query",
        () => new HttpResponse(null, { status: 500 }),
      ),
      http.get("https://dns.google/resolve", () => new HttpResponse(null, { status: 500 })),
    );

    const { verifyByDns } = await import("./index");
    const result = await verifyByDns("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
    // Every provider/host lookup errored — this is a failed check, not a
    // confirmed absence of the TXT record.
    expect(result.checkFailed).toBe(true);
  });

  it("does not report checkFailed when at least one provider returns a clean (non-matching) answer", async () => {
    server.use(
      http.get("https://cloudflare-dns.com/dns-query", () =>
        HttpResponse.json({ Status: 0, Answer: [] }),
      ),
      http.get("https://dns.google/resolve", () => new HttpResponse(null, { status: 500 })),
    );

    const { verifyByDns } = await import("./index");
    const result = await verifyByDns("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.checkFailed).toBeFalsy();
  });

  it("reports checkFailed when the apex host's lookups all fail, even though the unused legacy host resolves cleanly", async () => {
    // Legacy resolves cleanly (never had a record); apex is the host that
    // actually holds the proof and fails outright.
    const dohHandler = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");

      if (name === "apex-fail-legacy-clean.test") {
        return new HttpResponse(null, { status: 500 });
      }
      // Legacy host (_domainstack-verify.apex-fail-legacy-clean.test): clean, empty.
      return HttpResponse.json({ Status: 0, Answer: [] });
    };

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohHandler),
      http.get("https://dns.google/resolve", dohHandler),
    );

    const { verifyByDns } = await import("./index");
    const result = await verifyByDns("apex-fail-legacy-clean.test", token);

    expect(result.verified).toBe(false);
    expect(result.checkFailed).toBe(true);
  });
});

describe("verifyByHtmlFile", () => {
  const token = "testtoken123";
  const expectedContent = `domainstack-verify: ${token}`;

  it("returns verified when per-token file contains correct content", async () => {
    server.use(
      http.get(
        `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () =>
          new HttpResponse(expectedContent, {
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const { verifyByHtmlFile } = await import("./index");
    const result = await verifyByHtmlFile("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("html_file");
  });

  it("returns verified when per-token file has content with whitespace", async () => {
    server.use(
      http.get(
        `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () =>
          new HttpResponse(`  ${expectedContent}  \n`, {
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const { verifyByHtmlFile } = await import("./index");
    const result = await verifyByHtmlFile("verified-dns.test", token);

    expect(result.verified).toBe(true);
  });

  it("returns not verified when per-token file is empty", async () => {
    server.use(
      http.get(
        `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () =>
          new HttpResponse("", {
            headers: { "Content-Type": "text/html" },
          }),
      ),
      http.get(
        "https://verified-dns.test/.well-known/domainstack-verify.html",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const { verifyByHtmlFile } = await import("./index");
    const result = await verifyByHtmlFile("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
  });

  it("falls back to legacy file when per-token files not found", async () => {
    server.use(
      http.get(
        `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.get(
        `http://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.get(
        "https://verified-dns.test/.well-known/domainstack-verify.html",
        () =>
          new HttpResponse(expectedContent, {
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const { verifyByHtmlFile } = await import("./index");
    const result = await verifyByHtmlFile("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("html_file");
  });

  // Regression test: this method used to fall back to HTTP when HTTPS failed,
  // which let anyone on the network path forge an ownership proof. Ownership
  // verification is HTTPS-only now, so an HTTP-only token must fail.
  it("returns not verified when per-token file is only served over HTTP", async () => {
    let httpRequested = false;
    server.use(
      http.get(
        `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.get(`http://verified-dns.test/.well-known/domainstack-verify/${token}.html`, () => {
        httpRequested = true;
        return new HttpResponse(expectedContent, {
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    const { verifyByHtmlFile } = await import("./index");
    const result = await verifyByHtmlFile("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
    expect(httpRequested).toBe(false);
  });

  it("returns not verified when legacy file is only served over HTTP", async () => {
    let httpRequested = false;
    server.use(
      http.get(
        `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.get(
        "https://verified-dns.test/.well-known/domainstack-verify.html",
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.get("http://verified-dns.test/.well-known/domainstack-verify.html", () => {
        httpRequested = true;
        return new HttpResponse(expectedContent, {
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    const { verifyByHtmlFile } = await import("./index");
    const result = await verifyByHtmlFile("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
    expect(httpRequested).toBe(false);
  });

  it("returns not verified when all files not found", async () => {
    server.use(
      http.get("https://verified-dns.test/*", () => new HttpResponse(null, { status: 404 })),
      http.get("http://verified-dns.test/*", () => new HttpResponse(null, { status: 404 })),
    );

    const { verifyByHtmlFile } = await import("./index");
    const result = await verifyByHtmlFile("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
    // A real 404 is a confirmed absence, not a failed check.
    expect(result.checkFailed).toBeFalsy();
  });

  it("reports checkFailed when every URL is unreachable, not a confirmed absence", async () => {
    server.use(
      http.get(`https://verified-dns.test/.well-known/domainstack-verify/${token}.html`, () =>
        HttpResponse.error(),
      ),
      http.get("https://verified-dns.test/.well-known/domainstack-verify.html", () =>
        HttpResponse.error(),
      ),
    );

    const { verifyByHtmlFile } = await import("./index");
    const result = await verifyByHtmlFile("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.checkFailed).toBe(true);
  });
});

describe("verifyByMetaTag", () => {
  const token = "testtoken123";

  it("returns verified when meta tag with correct content exists", async () => {
    server.use(
      http.get(
        "https://verified-dns.test/",
        () =>
          new HttpResponse(
            `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const { verifyByMetaTag } = await import("./index");
    const result = await verifyByMetaTag("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("meta_tag");
  });

  it("handles meta tag with reversed attribute order", async () => {
    server.use(
      http.get(
        "https://verified-dns.test/",
        () =>
          new HttpResponse(
            `<html><head><meta content="${token}" name="domainstack-verify"></head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const { verifyByMetaTag } = await import("./index");
    const result = await verifyByMetaTag("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("meta_tag");
  });

  it("finds correct token among multiple verification meta tags", async () => {
    server.use(
      http.get(
        "https://verified-dns.test/",
        () =>
          new HttpResponse(
            `<html><head>
            <meta name="domainstack-verify" content="otheruser1token">
            <meta name="domainstack-verify" content="${token}">
            <meta name="domainstack-verify" content="otheruser2token">
          </head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const { verifyByMetaTag } = await import("./index");
    const result = await verifyByMetaTag("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("meta_tag");
  });

  it("returns not verified when token not in any of multiple meta tags", async () => {
    server.use(
      http.get(
        "https://verified-dns.test/",
        () =>
          new HttpResponse(
            `<html><head>
            <meta name="domainstack-verify" content="otheruser1token">
            <meta name="domainstack-verify" content="otheruser2token">
          </head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const { verifyByMetaTag } = await import("./index");
    const result = await verifyByMetaTag("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
  });

  it("handles malformed HTML gracefully", async () => {
    server.use(
      http.get(
        "https://verified-dns.test/",
        () =>
          new HttpResponse(
            `<html><head>
            <meta name="domainstack-verify" content="${token}"
            <meta name="description" content="test">
          </head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const { verifyByMetaTag } = await import("./index");
    const result = await verifyByMetaTag("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("meta_tag");
  });

  // Regression test: this method used to try HTTP as well as HTTPS, which let
  // anyone on the network path forge the meta tag response. Ownership
  // verification is HTTPS-only now, so a token served only over HTTP must fail.
  it("returns not verified when meta tag is only served over HTTP", async () => {
    let httpRequested = false;
    server.use(
      http.get("http://verified-dns.test/", () => {
        httpRequested = true;
        return new HttpResponse(
          `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
          { headers: { "Content-Type": "text/html" } },
        );
      }),
    );

    const { verifyByMetaTag } = await import("./index");
    const result = await verifyByMetaTag("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
    expect(httpRequested).toBe(false);
  });

  it("returns not verified when meta tag is missing", async () => {
    server.use(
      http.get(
        "https://verified-dns.test/",
        () =>
          new HttpResponse("<html><head><title>Test</title></head><body></body></html>", {
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const { verifyByMetaTag } = await import("./index");
    const result = await verifyByMetaTag("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
  });

  it("reports checkFailed when the page is unreachable, not a confirmed absence", async () => {
    server.use(http.get("https://verified-dns.test/", () => HttpResponse.error()));

    const { verifyByMetaTag } = await import("./index");
    const result = await verifyByMetaTag("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.checkFailed).toBe(true);
  });
});

describe("verifyDomain (all methods)", () => {
  const token = "testtoken123";

  it("returns dns_txt when DNS verification succeeds first", async () => {
    const dohHandler = () =>
      HttpResponse.json({
        Status: 0,
        Answer: [
          {
            name: "verified-dns.test.",
            type: 16,
            TTL: 300,
            data: `"domainstack-verification=${token}"`,
          },
        ],
      });

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohHandler),
      http.get("https://dns.google/resolve", dohHandler),
    );

    const { verifyDomain } = await import("./index");
    const result = await verifyDomain("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("dns_txt");
  });

  it("falls back to html_file when DNS fails", async () => {
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
      http.get(
        `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () =>
          new HttpResponse(`domainstack-verify: ${token}`, {
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const { verifyDomain } = await import("./index");
    const result = await verifyDomain("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("html_file");
  });

  it("falls back to meta_tag when DNS and HTML fail", async () => {
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
      http.get("https://verified-dns.test/.well-known/*", () =>
        HttpResponse.json(null, { status: 404 }),
      ),
      http.get("http://verified-dns.test/.well-known/*", () =>
        HttpResponse.json(null, { status: 404 }),
      ),
    );

    server.use(
      http.get(
        "https://verified-dns.test/",
        () =>
          new HttpResponse(
            `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const { verifyDomain } = await import("./index");
    const result = await verifyDomain("verified-dns.test", token);

    expect(result.verified).toBe(true);
    expect(result.method).toBe("meta_tag");
  });

  it("returns not verified when all methods fail", async () => {
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
      http.get("https://verified-dns.test/*", () => HttpResponse.json(null, { status: 404 })),
      http.get("http://verified-dns.test/*", () => HttpResponse.json(null, { status: 404 })),
    );

    const { verifyDomain } = await import("./index");
    const result = await verifyDomain("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.method).toBeNull();
  });

  it("reports checkFailed only when every method's probe fails to complete", async () => {
    // DNS confirms absence cleanly (no answer).
    server.use(
      http.get("https://cloudflare-dns.com/dns-query", () =>
        HttpResponse.json({ Status: 0, Answer: [] }),
      ),
      http.get("https://dns.google/resolve", () => HttpResponse.json({ Status: 0, Answer: [] })),
    );
    // HTML and meta tag are both unreachable.
    server.use(http.get("https://verified-dns.test/*", () => HttpResponse.error()));

    const { verifyDomain } = await import("./index");
    const result = await verifyDomain("verified-dns.test", token);

    expect(result.verified).toBe(false);
    // DNS's clean answer is a confirmed absence overall, even though the
    // other two methods couldn't be checked.
    expect(result.checkFailed).toBeFalsy();
  });

  it("reports checkFailed when all three methods' probes fail to complete", async () => {
    server.use(http.get("https://cloudflare-dns.com/dns-query", () => HttpResponse.error()));
    server.use(http.get("https://dns.google/resolve", () => HttpResponse.error()));
    server.use(http.get("https://verified-dns.test/*", () => HttpResponse.error()));

    const { verifyDomain } = await import("./index");
    const result = await verifyDomain("verified-dns.test", token);

    expect(result.verified).toBe(false);
    expect(result.checkFailed).toBe(true);
  });
});

describe("verifyDomainByMethod", () => {
  const token = "testtoken123";

  it("uses only dns_txt method when specified", async () => {
    const dohHandler = () =>
      HttpResponse.json({
        Status: 0,
        Answer: [
          {
            name: "verified-dns.test.",
            type: 16,
            TTL: 300,
            data: `"domainstack-verification=${token}"`,
          },
        ],
      });

    server.use(
      http.get("https://cloudflare-dns.com/dns-query", dohHandler),
      http.get("https://dns.google/resolve", dohHandler),
    );

    const { verifyDomainByMethod } = await import("./index");
    const result = await verifyDomainByMethod("verified-dns.test", token, "dns_txt");

    expect(result.verified).toBe(true);
    expect(result.method).toBe("dns_txt");
  });

  it("uses only html_file method when specified", async () => {
    server.use(
      http.get(
        `https://verified-dns.test/.well-known/domainstack-verify/${token}.html`,
        () =>
          new HttpResponse(`domainstack-verify: ${token}`, {
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const { verifyDomainByMethod } = await import("./index");
    const result = await verifyDomainByMethod("verified-dns.test", token, "html_file");

    expect(result.verified).toBe(true);
    expect(result.method).toBe("html_file");
  });

  it("uses only meta_tag method when specified", async () => {
    server.use(
      http.get(
        "https://verified-dns.test/",
        () =>
          new HttpResponse(
            `<html><head><meta name="domainstack-verify" content="${token}"></head></html>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const { verifyDomainByMethod } = await import("./index");
    const result = await verifyDomainByMethod("verified-dns.test", token, "meta_tag");

    expect(result.verified).toBe(true);
    expect(result.method).toBe("meta_tag");
  });
});
