export const tools = [
  {
    name: "domain_registration",
    description:
      "Get WHOIS/RDAP registration data including registrar, creation date, expiration date, nameservers, and registrant information.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_dns",
    description: "Get DNS records including A, AAAA, CNAME, MX, TXT, NS, and SOA records.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_hosting",
    description:
      "Detect hosting, DNS, CDN, and email providers by analyzing DNS records and HTTP headers.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_certificates",
    description:
      "Get SSL/TLS certificate information including issuer, validity dates, and certificate chain.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_headers",
    description:
      "Get HTTP response headers including security headers, caching headers, and server information.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_seo",
    description:
      "Get SEO metadata including title, description, Open Graph tags, Twitter cards, and robots.txt rules.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_report",
    description:
      "Get a comprehensive domain report combining multiple data sources in a single call. Use the sections parameter to request only specific data.",
    parameters: [
      { name: "domain", type: "string", required: true },
      {
        name: "sections",
        type: "string[]",
        required: false,
        description:
          'Array of section(s) to compile: "dns", "registration", "hosting", "certificates", "headers", "seo". Defaults to all.',
      },
    ],
  },
];
