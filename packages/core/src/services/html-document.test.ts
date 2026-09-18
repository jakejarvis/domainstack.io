/* @vitest-environment node */
import type { lookup as dnsLookup } from "node:dns/promises";

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLookup } = vi.hoisted(() => ({
  mockLookup: vi.fn<typeof dnsLookup>(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
}));

import { fetchHtmlDocument } from "./html-document";

type LookupResult = Awaited<ReturnType<typeof dnsLookup>>;
const PUBLIC_LOOKUP: LookupResult = [
  { address: "93.184.216.34", family: 4 },
] as unknown as LookupResult;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  mockLookup.mockReset();
  mockLookup.mockResolvedValue(PUBLIC_LOOKUP);
});

describe("fetchHtmlDocument", () => {
  it("returns ok, decoded body, lowercased headers, and setCookie for a 200 HTML response", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://ok.test/", () => {
        requestCount++;
        const headers = new Headers({ "Content-Type": "text/html" });
        headers.append("Set-Cookie", "sid=abc; Path=/");
        headers.append("Set-Cookie", "theme=dark; Path=/");
        return new HttpResponse("<html><body>Hi</body></html>", { status: 200, headers });
      }),
    );

    const doc = await fetchHtmlDocument("ok.test");

    expect(doc.ok).toBe(true);
    expect(doc.html).toBe("<html><body>Hi</body></html>");
    expect(doc.headers["content-type"]).toBe("text/html");
    expect(doc.setCookie).toEqual(["sid=abc; Path=/", "theme=dark; Path=/"]);
    expect(requestCount).toBe(1);
  });

  it("returns an HTTP error for a 404 response", async () => {
    server.use(
      http.get("https://missing.test/", () => new HttpResponse("Not Found", { status: 404 })),
    );

    const doc = await fetchHtmlDocument("missing.test");

    expect(doc.ok).toBe(false);
    expect(doc.error).toBe("HTTP 404");
    expect(doc.html).toBeNull();
  });

  it("returns a non-HTML content-type error for a JSON response", async () => {
    server.use(
      http.get(
        "https://json.test/",
        () =>
          new HttpResponse('{"ok":true}', {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const doc = await fetchHtmlDocument("json.test");

    expect(doc.ok).toBe(false);
    expect(doc.error).toMatch(/^Non-HTML content-type: /);
    expect(doc.html).toBeNull();
  });

  it("dedupes concurrent calls for the same domain into one request", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://concurrent.test/", async () => {
        requestCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new HttpResponse("<html>concurrent</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    const [a, b] = await Promise.all([
      fetchHtmlDocument("concurrent.test"),
      fetchHtmlDocument("concurrent.test"),
    ]);

    expect(requestCount).toBe(1);
    expect(a).toBe(b);
  });

  it("fetches fresh on sequential (non-overlapping) calls", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://sequential.test/", () => {
        requestCount++;
        return new HttpResponse("<html>sequential</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    await fetchHtmlDocument("sequential.test");
    await fetchHtmlDocument("sequential.test");

    expect(requestCount).toBe(2);
  });

  it("shares the in-flight request across case variants of the same domain", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://case.test/", async () => {
        requestCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new HttpResponse("<html>case</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    const [a, b] = await Promise.all([
      fetchHtmlDocument("case.test"),
      fetchHtmlDocument("CASE.test"),
    ]);

    expect(requestCount).toBe(1);
    expect(a).toBe(b);
  });
});
