/**
 * Package-local MSW test server.
 *
 * Only the handlers actually exercised by this package's tests — iplocate.io
 * GeoIP lookups. Copied (trimmed) from apps/web/mocks/handlers.ts. Tests that
 * need other endpoints register them per-test with `server.use(...)`.
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

const ipLocateHandler = ({ params }: { params: { ip: string } }) => {
  const { ip } = params;

  // Default mock response (iplocate.io format)
  // See: https://www.iplocate.io/docs/ip-intelligence-api/data-types
  const response = {
    ip,
    is_eu: false,
    city: "Mountain View",
    subdivision: "California",
    country: "United States",
    country_code: "US",
    continent: "North America",
    latitude: 37.386,
    longitude: -122.0838,
    postal_code: "94040",
    calling_code: "1",
    time_zone: "America/Los_Angeles",
    currency_code: "USD",
    is_anycast: false,
    is_satellite: false,
    asn: {
      asn: "AS15169",
      name: "Google LLC",
      domain: "google.com",
      route: "8.8.8.0/24",
      netname: "GOOGLE",
      type: "hosting",
      country_code: "US",
      rir: "ARIN",
    },
    company: {
      name: "Google LLC",
      domain: "google.com",
      country_code: "US",
      type: "hosting",
    },
    hosting: {
      provider: "Google Cloud",
      domain: "cloud.google.com",
      network: "8.8.8.0/24",
    },
    privacy: {
      is_abuser: false,
      is_anonymous: false,
      is_bogon: false,
      is_hosting: true,
      is_icloud_relay: false,
      is_proxy: false,
      is_tor: false,
      is_vpn: false,
    },
  };

  // Specific mocks for known IPs if needed
  if (ip === "1.1.1.1") {
    response.asn.name = "Cloudflare, Inc.";
    response.asn.domain = "cloudflare.com";
    response.company.name = "Cloudflare, Inc.";
    response.company.domain = "cloudflare.com";
    response.city = "San Francisco";
    response.latitude = 37.7;
    response.longitude = -122.4;
  }

  if (ip === "9.9.9.9") {
    response.asn.name = "My ISP";
    response.asn.domain = "isp.example";
    response.company.name = "My ISP";
    response.company.domain = "isp.example";
  }

  return HttpResponse.json(response);
};

const handlers = [
  // IP Lookup (iplocate.io)
  http.get("https://www.iplocate.io/api/lookup/:ip", ipLocateHandler),
];

export const server = setupServer(...handlers);
