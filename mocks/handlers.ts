import { HttpResponse, http } from "msw";

// Mock DNS records map
const DNS_RECORDS: Record<string, Record<string, unknown[]>> = {
  // .test domains (used in verification.test.ts, etc.)
  "verified-dns.test": {
    A: [{ name: "verified-dns.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
    AAAA: [
      {
        name: "verified-dns.test.",
        type: 28,
        TTL: 60,
        data: "2001:4860:4860::8888",
      },
    ],
    MX: [
      {
        name: "verified-dns.test.",
        type: 15,
        TTL: 300,
        data: "10 mail.verified-dns.test.",
      },
    ],
    TXT: [{ name: "verified-dns.test.", type: 16, TTL: 120, data: '"v=spf1"' }],
    NS: [
      {
        name: "verified-dns.test.",
        type: 2,
        TTL: 600,
        data: "ns1.verified-dns.test.",
      },
    ],
  },
  "multi-mx.test": {
    MX: [
      {
        name: "multi-mx.test.",
        type: 15,
        TTL: 300,
        data: "10 mx1.multi-mx.test.",
      },
      {
        name: "multi-mx.test.",
        type: 15,
        TTL: 300,
        data: "20 mx2.multi-mx.test.",
      },
    ],
  },
  "cname-chain.test": {
    A: [
      {
        name: "cname-chain.test.",
        type: 5,
        TTL: 21600,
        data: "alias.cname-chain.test.",
      },
      {
        name: "alias.cname-chain.test.",
        type: 5,
        TTL: 60,
        data: "target.cname-chain.test.",
      },
      {
        name: "target.cname-chain.test.",
        type: 1,
        TTL: 20,
        data: "23.213.158.77",
      },
      {
        name: "target.cname-chain.test.",
        type: 1,
        TTL: 20,
        data: "23.213.158.81",
      },
    ],
  },
  "no-a.test": {
    MX: [
      {
        name: "no-a.test.",
        type: 15,
        TTL: 300,
        data: "10 mail.no-a.test.",
      },
    ],
    NS: [
      {
        name: "no-a.test.",
        type: 2,
        TTL: 600,
        data: "ns1.no-a.test.",
      },
    ],
  },
  "email-only.test": {
    MX: [
      {
        name: "email-only.test.",
        type: 15,
        TTL: 300,
        data: "10 mail.email-only.test.",
      },
    ],
    NS: [
      {
        name: "email-only.test.",
        type: 2,
        TTL: 600,
        data: "ns1.email-only.test.",
      },
    ],
  },
  "web-hosting.test": {
    A: [{ name: "web-hosting.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
    NS: [
      {
        name: "web-hosting.test.",
        type: 2,
        TTL: 600,
        data: "ns1.web-hosting.test.",
      },
    ],
  },
  "fallbacks.test": {
    A: [{ name: "fallbacks.test.", type: 1, TTL: 60, data: "1.1.1.1" }],
    MX: [
      {
        name: "fallbacks.test.",
        type: 15,
        TTL: 300,
        data: "10 mx.fallbacks.test.",
      },
    ],
    NS: [
      {
        name: "fallbacks.test.",
        type: 2,
        TTL: 600,
        data: "ns1.fallbacks.test.",
      },
    ],
  },
  "provider-create.test": {
    A: [{ name: "provider-create.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
    MX: [
      {
        name: "provider-create.test.",
        type: 15,
        TTL: 300,
        data: "10 mail.provider-create.test.",
      },
    ],
    NS: [
      {
        name: "provider-create.test.",
        type: 2,
        TTL: 600,
        data: "ns1.provider-create.test.",
      },
    ],
  },
  "nonhtml.test": {
    A: [{ name: "nonhtml.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },
  "robots-content.test": {
    A: [{ name: "robots-content.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },
  "img-fail.test": {
    A: [{ name: "img-fail.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },
  "ssrf-test.test": {
    A: [{ name: "ssrf-test.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },
  "relative-url.test": {
    A: [{ name: "relative-url.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },
  "loopback.test": {
    A: [{ name: "loopback.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },
  "private-resolve.test": {
    A: [{ name: "private-resolve.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },
  "assets.test": {
    A: [{ name: "assets.test.", type: 1, TTL: 60, data: "10.0.0.12" }], // Private IP
  },
  "nxdomain.test": {
    // No records
  },
  "negcache.test": {
    A: [{ name: "negcache.test.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },

  // .example domains (used in hosting.test.ts)
  "web-hosting.example": {
    A: [{ name: "web-hosting.example.", type: 1, TTL: 60, data: "1.2.3.4" }],
    NS: [
      {
        name: "web-hosting.example.",
        type: 2,
        TTL: 600,
        data: "ns1.cloudflare.com.",
      },
    ],
  },
  "no-a.example": {
    MX: [
      {
        name: "no-a.example.",
        type: 15,
        TTL: 300,
        data: "10 mail.no-a.example.",
      },
    ],
    NS: [
      {
        name: "no-a.example.",
        type: 2,
        TTL: 600,
        data: "ns1.no-a.example.",
      },
    ],
  },
  "email-only.example": {
    MX: [
      {
        name: "email-only.example.",
        type: 15,
        TTL: 300,
        data: "10 mail.email-only.example.",
      },
    ],
    NS: [
      {
        name: "email-only.example.",
        type: 2,
        TTL: 600,
        data: "ns1.email-only.example.",
      },
    ],
  },
  "owner.example": {
    A: [{ name: "owner.example.", type: 1, TTL: 60, data: "9.9.9.9" }],
  },
  "provider-create.example": {
    A: [
      { name: "provider-create.example.", type: 1, TTL: 60, data: "1.2.3.4" },
    ],
    MX: [
      {
        name: "provider-create.example.",
        type: 15,
        TTL: 300,
        data: "10 aspmx.l.google.com.", // Known provider (Google)
      },
    ],
    NS: [
      {
        name: "provider-create.example.",
        type: 2,
        TTL: 600,
        data: "ns1.cloudflare.com.", // Known provider (Cloudflare)
      },
    ],
  },
  "icons.duckduckgo.com": {
    A: [{ name: "icons.duckduckgo.com.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },
  "www.google.com": {
    A: [{ name: "www.google.com.", type: 1, TTL: 60, data: "1.2.3.4" }],
  },
};

// Helper to find records by name and type
function getRecords(name: string, type: string) {
  const domain = name.replace(/\.$/, "").toLowerCase();
  const domainRecords = DNS_RECORDS[domain];
  if (!domainRecords) return [];

  // Map strict DNS types to keys if needed, or just look up
  // This is a simplified lookup for the mock
  return domainRecords[type] || [];
}

const dohHandler = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const type = url.searchParams.get("type");

  if (!name || !type) {
    return HttpResponse.json({ Status: 2 }); // SERVFAIL
  }

  const answers = getRecords(name, type);

  return HttpResponse.json({
    Status: 0,
    Answer: answers,
  });
};

const ipWhoIsHandler = ({ params }: { params: { ip: string } }) => {
  const { ip } = params;

  // Default mock response
  const response = {
    ip,
    success: true,
    type: "IPv4",
    continent: "North America",
    continent_code: "NA",
    country: "United States",
    country_code: "US",
    region: "California",
    region_code: "CA",
    city: "Mountain View",
    latitude: 37.386,
    longitude: -122.0838,
    is_eu: false,
    postal: "94040",
    calling_code: "1",
    capital: "Washington D.C.",
    borders: "CA,MX",
    flag: {
      img: "https://cdn.ipwhois.io/flags/us.svg",
      emoji: "🇺🇸",
      emoji_unicode: "U+1F1FA U+1F1F8",
    },
    connection: {
      asn: 15169,
      org: "Google LLC",
      isp: "Google LLC",
      domain: "google.com",
    },
    timezone: {
      id: "America/Los_Angeles",
      abbr: "PST",
      is_dst: false,
      offset: -28800,
      utc: "-08:00",
      current_time: "2024-01-01T12:00:00-08:00",
    },
  };

  // Specific mocks for known IPs if needed
  if (ip === "1.1.1.1") {
    response.connection.org = "Cloudflare, Inc.";
    response.connection.isp = "Cloudflare, Inc.";
    response.connection.domain = "cloudflare.com";
    response.city = "San Francisco";
    response.latitude = 37.7;
    response.longitude = -122.4;
  }

  if (ip === "9.9.9.9") {
    response.connection.org = "My ISP";
    response.connection.isp = "My ISP";
    response.connection.domain = "isp.example";
  }

  return HttpResponse.json(response);
};

const rdapBootstrapHandler = () => {
  return HttpResponse.json({
    version: "1.0",
    publication: "2024-01-01T00:00:00Z",
    services: [
      [
        ["com", "net", "test"],
        [
          "https://rdap.verisign.com/com/v1/",
          "http://rdap.verisign.com/com/v1/",
        ],
      ],
      [["io"], ["https://rdap.nic.io/domain/"]],
    ],
  });
};

// Mock RDAP server responses
const rdapDomainHandler = ({ params }: { params: { domain: string } }) => {
  const { domain } = params;

  if (domain === "verified-dns.test") {
    return HttpResponse.json({
      objectClassName: "domain",
      handle: "DOM-12345",
      ldhName: "verified-dns.test",
      status: ["client transfer prohibited"],
      events: [
        { eventAction: "registration", eventDate: "1995-08-14T04:00:00Z" },
        { eventAction: "expiration", eventDate: "2025-08-13T04:00:00Z" },
        { eventAction: "last changed", eventDate: "2024-08-14T04:00:00Z" },
      ],
      entities: [
        {
          objectClassName: "entity",
          roles: ["registrar"],
          vcardArray: [
            "vcard",
            [
              ["version", {}, "text", "4.0"],
              ["fn", {}, "text", "Test Registrar, Inc."],
            ],
          ],
        },
      ],
    });
  }

  return HttpResponse.json({ error: "Not found" }, { status: 404 });
};

// Pricing Providers Mocks
const porkbunPricingHandler = () => {
  return HttpResponse.json({
    status: "SUCCESS",
    pricing: {
      com: {
        registration: "10.00",
        renewal: "10.00",
        transfer: "10.00",
      },
      net: {
        registration: "11.00",
        renewal: "11.00",
        transfer: "11.00",
      },
      io: {
        registration: "35.00",
        renewal: "35.00",
        transfer: "30.00",
      },
    },
  });
};

const cloudflarePricingHandler = () => {
  return HttpResponse.json({
    com: { registration: 9.15, renewal: 9.15 },
    net: { registration: 10.15, renewal: 10.15 },
    io: { registration: 40.0, renewal: 40.0 },
  });
};

const dynadotPricingHandler = () => {
  return HttpResponse.json({
    code: 200,
    message: "success",
    data: {
      tldPriceList: [
        { tld: ".com", allYearsRegisterPrice: [10.99] },
        { tld: ".net", allYearsRegisterPrice: [11.99] },
        { tld: ".io", allYearsRegisterPrice: [38.99] },
      ],
    },
  });
};

// Generic Domain Content (SEO/Verification)
const genericDomainHandler = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const domain = url.hostname;

  // Simple HTML mock
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${domain}</title>
      <meta name="description" content="Mock description for ${domain}">
      <meta name="domainstack-verify" content="mock-token-123">
      <link rel="icon" href="/favicon.ico">
    </head>
    <body>
      <h1>Welcome to ${domain}</h1>
    </body>
    </html>
  `;

  const headers: Record<string, string> = {
    "Content-Type": "text/html",
  };

  // Simulate Vercel hosting for hosting.test.ts
  if (domain === "web-hosting.example") {
    headers.Server = "Vercel";
  }

  return new HttpResponse(html, {
    headers,
  });
};

const verificationFileHandler = () => {
  return new HttpResponse("domainstack-verify=mock-token-123", {
    headers: { "Content-Type": "text/html" },
  });
};

// Mock 1x1 transparent PNG
const iconHandler = () => {
  const buffer = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
    0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120,
    156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68,
    174, 66, 96, 130,
  ]);

  return new HttpResponse(buffer, {
    headers: { "Content-Type": "image/png" },
  });
};

// Resend API Mocks
const resendApiHandler = () => {
  return HttpResponse.json({
    id: "re_mock_123456789",
    object: "email",
    created_at: new Date().toISOString(),
  });
};

const resendContactHandler = () => {
  return HttpResponse.json({
    object: "contact",
    id: "c_mock_123456789",
  });
};

const cloudflareIpsHandler = () => {
  return HttpResponse.json({
    success: true,
    result: {
      ipv4_cidrs: ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22"],
      ipv6_cidrs: ["2400:cb00::/32", "2606:4700::/32"],
    },
  });
};

// Generic handlers
export const handlers = [
  // DNS over HTTPS
  http.get("https://cloudflare-dns.com/dns-query", dohHandler),
  http.get("https://dns.google/resolve", dohHandler),

  // Cloudflare IPs
  http.get("https://api.cloudflare.com/client/v4/ips", cloudflareIpsHandler),

  // IP Lookup
  http.get("https://ipwho.is/:ip", ipWhoIsHandler),

  // RDAP Bootstrap
  http.get("https://data.iana.org/rdap/dns.json", rdapBootstrapHandler),

  // RDAP Servers (mock generic paths or specific known ones)
  http.get(
    "https://rdap.verisign.com/com/v1/domain/:domain",
    rdapDomainHandler,
  ),
  http.get("https://rdap.nic.io/domain/:domain", rdapDomainHandler),

  // Resend API
  http.post("https://api.resend.com/emails", resendApiHandler),
  http.post("https://api.resend.com/contacts", resendContactHandler),
  http.delete("https://api.resend.com/contacts/*", resendContactHandler),

  // Pricing Providers
  http.post(
    "https://api.porkbun.com/api/json/v3/pricing/get",
    porkbunPricingHandler,
  ),
  http.get("https://cfdomainpricing.com/prices.json", cloudflarePricingHandler),
  http.get(
    "https://api.dynadot.com/restful/v1/domains/get_tld_price",
    dynadotPricingHandler,
  ),

  // Domain Content (SEO/Verification)
  // Match common test domains
  // Use http.all to match GET, HEAD, etc.
  http.all("http://verified-dns.test/", genericDomainHandler),
  http.all("https://verified-dns.test/", genericDomainHandler),
  http.all("http://web-hosting.test/", genericDomainHandler),
  http.all("https://web-hosting.test/", genericDomainHandler),
  http.all("http://cname-chain.test/", genericDomainHandler),
  http.all("https://cname-chain.test/", genericDomainHandler),
  http.all("http://multi-mx.test/", genericDomainHandler),
  http.all("https://multi-mx.test/", genericDomainHandler),

  // .example domains
  http.all("http://web-hosting.example/", genericDomainHandler),
  http.all("https://web-hosting.example/", genericDomainHandler),
  http.all("http://no-a.example/", genericDomainHandler),
  http.all("https://no-a.example/", genericDomainHandler),
  http.all("http://email-only.example/", genericDomainHandler),
  http.all("https://email-only.example/", genericDomainHandler),
  http.all("http://owner.example/", genericDomainHandler),
  http.all("https://owner.example/", genericDomainHandler),
  http.all("http://fallbacks.example/", genericDomainHandler),
  http.all("https://fallbacks.example/", genericDomainHandler),
  http.all("http://provider-create.example/", genericDomainHandler),
  http.all("https://provider-create.example/", genericDomainHandler),

  // Verification File
  http.get(
    "http://*/.well-known/domainstack-verify.html",
    verificationFileHandler,
  ),
  http.get(
    "https://*/.well-known/domainstack-verify.html",
    verificationFileHandler,
  ),

  // Favicons/Icons
  http.get("http://*/favicon.ico", iconHandler),
  http.get("https://*/favicon.ico", iconHandler),
  http.get("http://*/apple-touch-icon.png", iconHandler),
  http.get("https://*/apple-touch-icon.png", iconHandler),
  http.get("http://*/apple-icon.png", iconHandler),
  http.get("https://*/apple-icon.png", iconHandler),

  // Favicon Fallbacks
  http.get("https://icons.duckduckgo.com/ip3/:domain.ico", iconHandler),
  http.get("https://www.google.com/s2/favicons", iconHandler),
];
