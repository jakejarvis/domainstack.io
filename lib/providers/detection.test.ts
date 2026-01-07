/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  detectCertificateAuthority,
  detectDnsProvider,
  detectEmailProvider,
  detectHostingProvider,
  detectRegistrar,
} from "./detection";
import type { Provider } from "./parser";

// Mock provider catalogs for testing
const MOCK_HOSTING_PROVIDERS: Provider[] = [
  {
    name: "Vercel",
    domain: "vercel.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerEquals", name: "server", value: "vercel" },
        { kind: "headerPresent", name: "x-vercel-id" },
      ],
    },
  },
];

const MOCK_EMAIL_PROVIDERS: Provider[] = [
  {
    name: "Google Workspace",
    domain: "google.com",
    category: "email",
    rule: {
      any: [
        { kind: "mxSuffix", suffix: "smtp.google.com" },
        { kind: "mxSuffix", suffix: "aspmx.l.google.com" },
        { kind: "mxSuffix", suffix: "googlemail.com" },
      ],
    },
  },
];

const MOCK_DNS_PROVIDERS: Provider[] = [
  {
    name: "Cloudflare",
    domain: "cloudflare.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "cloudflare.com" },
  },
  {
    name: "Amazon Route 53",
    domain: "aws.amazon.com",
    category: "dns",
    rule: {
      any: [
        {
          kind: "nsRegex",
          pattern: "^ns-\\d+\\.awsdns-\\d+\\.(com|net|org|co\\.uk)$",
          flags: "i",
        },
        {
          kind: "nsRegex",
          pattern: "^ns\\d+\\.amzndns.(com|net|org|co\\.uk)$",
          flags: "i",
        },
      ],
    },
  },
];

const MOCK_REGISTRAR_PROVIDERS: Provider[] = [
  {
    name: "GoDaddy",
    domain: "godaddy.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "godaddy" },
        { kind: "registrarIncludes", substr: "go daddy" },
        { kind: "registrarIncludes", substr: "wild west domains" },
      ],
    },
  },
];

const MOCK_CA_PROVIDERS: Provider[] = [
  {
    name: "Let's Encrypt",
    domain: "letsencrypt.org",
    category: "ca",
    rule: {
      any: [
        { kind: "issuerIncludes", substr: "let's encrypt" },
        { kind: "issuerIncludes", substr: "lets encrypt" },
        { kind: "issuerIncludes", substr: "isrg" },
        { kind: "issuerEquals", value: "r3" },
        { kind: "issuerEquals", value: "r10" },
        { kind: "issuerEquals", value: "e1" },
      ],
    },
  },
];

describe("provider detection", () => {
  it("detects hosting from headers (Vercel)", () => {
    const headers = [
      { name: "Server", value: "Vercel" },
      { name: "x-vercel-id", value: "abc" },
    ];
    const res = detectHostingProvider(headers, MOCK_HOSTING_PROVIDERS);
    expect(res).not.toBeNull();
    expect(res?.name).toBe("Vercel");
    expect(res?.domain).toBe("vercel.com");
  });

  it("returns null when no hosting provider matches", () => {
    const headers = [{ name: "Server", value: "Apache" }];
    const res = detectHostingProvider(headers, MOCK_HOSTING_PROVIDERS);
    expect(res).toBeNull();
  });

  it("detects email from MX (Google)", () => {
    const res = detectEmailProvider(
      ["aspmx.l.google.com."],
      MOCK_EMAIL_PROVIDERS,
    );
    expect(res).not.toBeNull();
    expect(res?.name).toBe("Google Workspace");
    expect(res?.domain).toBe("google.com");
  });

  it("returns null when no email provider matches", () => {
    const res = detectEmailProvider(
      ["mail.unknown-provider.com"],
      MOCK_EMAIL_PROVIDERS,
    );
    expect(res).toBeNull();
  });

  it("detects DNS from NS (Cloudflare)", () => {
    const res = detectDnsProvider(
      ["ns1.cloudflare.com", "ns2.cloudflare.com"],
      MOCK_DNS_PROVIDERS,
    );
    expect(res).not.toBeNull();
    expect(res?.name).toBe("Cloudflare");
    expect(res?.domain).toBe("cloudflare.com");
  });

  it("detects DNS from NS (Amazon Route 53)", () => {
    const res = detectDnsProvider(
      ["ns-2048.awsdns-64.com", "ns-2049.awsdns-65.net"],
      MOCK_DNS_PROVIDERS,
    );
    expect(res).not.toBeNull();
    expect(res?.name).toBe("Amazon Route 53");
    expect(res?.domain).toBe("aws.amazon.com");
  });

  it("returns null when no DNS provider matches", () => {
    const res = detectDnsProvider(["ns1.unknown-dns.com"], MOCK_DNS_PROVIDERS);
    expect(res).toBeNull();
  });

  it("detects registrar from name (GoDaddy)", () => {
    const res = detectRegistrar("GoDaddy Inc.", MOCK_REGISTRAR_PROVIDERS);
    expect(res).not.toBeNull();
    expect(res?.name).toBe("GoDaddy");
    expect(res?.domain).toBe("godaddy.com");
  });

  it("returns null for unknown registrar", () => {
    const res = detectRegistrar("Unknown Registrar", MOCK_REGISTRAR_PROVIDERS);
    expect(res).toBeNull();
  });

  it("returns null for empty registrar name", () => {
    const res = detectRegistrar("", MOCK_REGISTRAR_PROVIDERS);
    expect(res).toBeNull();
  });

  it("detects CA from issuer string (Let's Encrypt)", () => {
    const res = detectCertificateAuthority(
      "Let's Encrypt R3",
      MOCK_CA_PROVIDERS,
    );
    expect(res).not.toBeNull();
    expect(res?.name).toBe("Let's Encrypt");
    expect(res?.domain).toBe("letsencrypt.org");
  });

  it("detects CA from issuer string (Let's Encrypt R10)", () => {
    const res = detectCertificateAuthority("R10", MOCK_CA_PROVIDERS);
    expect(res).not.toBeNull();
    expect(res?.name).toBe("Let's Encrypt");
    expect(res?.domain).toBe("letsencrypt.org");
  });

  it("returns null for unknown CA", () => {
    const res = detectCertificateAuthority(
      "Unknown CA Inc.",
      MOCK_CA_PROVIDERS,
    );
    expect(res).toBeNull();
  });

  it("returns null for empty issuer", () => {
    const res = detectCertificateAuthority("", MOCK_CA_PROVIDERS);
    expect(res).toBeNull();
  });

  it("gracefully handles empty provider arrays", () => {
    expect(detectHostingProvider([], [])).toBeNull();
    expect(detectEmailProvider(["mx.example.com"], [])).toBeNull();
    expect(detectDnsProvider(["ns1.example.com"], [])).toBeNull();
    expect(detectRegistrar("Some Registrar", [])).toBeNull();
    expect(detectCertificateAuthority("Some CA", [])).toBeNull();
  });
});
