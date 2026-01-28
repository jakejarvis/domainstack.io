/**
 * MSW test setup for verification module tests.
 *
 * This provides a minimal mock server with only the handlers needed
 * for testing domain verification (DNS, HTML file, meta tag methods).
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

/**
 * DoH (DNS over HTTPS) handler that returns A records for *.test domains
 * so safeFetch can resolve them. TXT records return empty by default.
 * Tests can override this with server.use() to provide specific responses.
 */
const dohHandler = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  // Return A record for any test domain so safeFetch can resolve it
  if (type === "A") {
    return HttpResponse.json({
      Status: 0,
      Answer: [
        {
          name: "verified-dns.test.",
          type: 1,
          TTL: 60,
          data: "1.2.3.4", // Safe public IP for tests
        },
      ],
    });
  }

  // TXT records return empty by default - tests override as needed
  return HttpResponse.json({
    Status: 0,
    Answer: [],
  });
};

/**
 * Generic 404 handler for test domains.
 * Tests override this with specific responses as needed.
 */
const notFoundHandler = () => new HttpResponse(null, { status: 404 });

const handlers = [
  // DNS over HTTPS providers
  http.get("https://cloudflare-dns.com/dns-query", dohHandler),
  http.get("https://dns.google/resolve", dohHandler),

  // Catch-all for test domain HTTP requests (verification file, meta tag)
  http.get("https://*.test/*", notFoundHandler),
  http.get("http://*.test/*", notFoundHandler),
  http.get("https://*.test/", notFoundHandler),
  http.get("http://*.test/", notFoundHandler),
];

export const server = setupServer(...handlers);
