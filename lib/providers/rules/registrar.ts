import type { Provider } from "@/lib/schemas";

/** Registrar providers registry for WHOIS/RDAP partial name matching */
export const REGISTRAR_PROVIDERS: Array<
  Omit<Provider, "category"> & { category: "registrar" }
> = [
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
  {
    name: "Namecheap",
    domain: "namecheap.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "namecheap" },
  },
  {
    name: "Spaceship",
    domain: "spaceship.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "spaceship" },
  },
  {
    name: "Squarespace",
    domain: "squarespace.domains",
    category: "registrar",
    rule: {
      any: [{ kind: "registrarIncludes", substr: "squarespace" }],
    },
  },
  // Keep Google LLC for rare legacy WHOIS text, but do not alias to MarkMonitor (separate registrar).
  {
    name: "Google",
    domain: "google.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "google" },
  },
  {
    name: "Cloudflare",
    domain: "cloudflare.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "cloudflare" },
  },
  {
    name: "Amazon Route 53",
    domain: "aws.amazon.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "amazon" },
  },
  {
    name: "Sav.com",
    domain: "sav.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "sav" },
  },
  {
    name: "1API",
    domain: "1api.net",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "1api" },
  },
  {
    name: "Gandi",
    domain: "gandi.net",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "gandi" },
  },
  {
    name: "Tucows",
    domain: "tucowsdomains.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "tucows" },
        { kind: "registrarIncludes", substr: "hover" },
        { kind: "registrarIncludes", substr: "opensrs" },
      ],
    },
  },
  {
    name: "OVHcloud",
    domain: "ovhcloud.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "ovhcloud" },
        { kind: "registrarIncludes", substr: "ovhgroup" },
        { kind: "registrarIncludes", substr: "ovh sas" },
      ],
    },
  },
  {
    name: "1&1 IONOS",
    domain: "ionos.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "1&1" },
        { kind: "registrarIncludes", substr: "ionos" },
        { kind: "registrarIncludes", substr: "united internet" },
      ],
    },
  },
  {
    name: "Name.com",
    domain: "name.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "name.com" },
        { kind: "registrarIncludes", substr: "rightside" },
        { kind: "registrarIncludes", substr: "afilias" },
        { kind: "registrarIncludes", substr: "donuts" },
        { kind: "registrarIncludes", substr: "identity digital" },
      ],
    },
  },
  {
    name: "Dynadot",
    domain: "dynadot.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "dynadot" },
  },
  {
    name: "Porkbun",
    domain: "porkbun.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "porkbun" },
  },
  {
    name: "Alibaba Cloud",
    domain: "alibaba.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "alibaba" },
        { kind: "registrarIncludes", substr: "aliyun" },
      ],
    },
  },
  {
    name: "Enom",
    domain: "enom.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "enom" },
  },
  {
    name: "GMO Internet",
    domain: "gmo.jp",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "gmo internet" },
        { kind: "registrarIncludes", substr: "onamae" },
      ],
    },
  },
  {
    name: "Openprovider (Registrar.eu)",
    domain: "openprovider.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "hosting concepts" },
        { kind: "registrarIncludes", substr: "registrar.eu" },
      ],
    },
  },
  {
    name: "EuroDNS",
    domain: "eurodns.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "eurodns" },
  },
  {
    name: "Network Solutions",
    domain: "networksolutions.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "network solutions" },
        { kind: "registrarIncludes", substr: "networksolutions" },
        { kind: "registrarIncludes", substr: "web.com" },
      ],
    },
  },
  {
    name: "Register.com",
    domain: "register.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "register.com" },
        { kind: "registrarIncludes", substr: "register, inc" },
        { kind: "registrarIncludes", substr: "register inc" },
      ],
    },
  },
  {
    name: "Automattic",
    domain: "wordpress.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "automattic" },
        { kind: "registrarIncludes", substr: "wordpress.com" },
      ],
    },
  },
  {
    name: "MarkMonitor",
    domain: "markmonitor.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "markmonitor" },
  },
  {
    name: "CSC Corporate Domains",
    domain: "cscdbs.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "csc corporate" },
        { kind: "registrarIncludes", substr: "csc global" },
      ],
    },
  },
  {
    name: "Ascio",
    domain: "ascio.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "ascio" },
  },
  {
    name: "Key-Systems",
    domain: "key-systems.net",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "key-systems" },
        { kind: "registrarIncludes", substr: "rrpproxy" },
      ],
    },
  },
  {
    name: "PublicDomainRegistry (PDR)",
    domain: "publicdomainregistry.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "publicdomainregistry" },
        { kind: "registrarIncludes", substr: "pdr ltd" },
      ],
    },
  },
  {
    name: "Wix",
    domain: "wix.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "wix" },
  },
  {
    name: "RegistrarSafe",
    domain: "meta.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "registrarsafe" },
  },
  {
    name: "Com Laude",
    domain: "comlaude.com",
    category: "registrar",
    rule: {
      any: [
        { kind: "registrarIncludes", substr: "nom-iq" },
        { kind: "registrarIncludes", substr: "comlaude" },
      ],
    },
  },
  {
    name: "NameBright",
    domain: "namebright.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "namebright" },
  },

  {
    name: "Domain.com",
    domain: "domain.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "domain.com" },
  },
  {
    name: "DreamHost",
    domain: "dreamhost.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "dreamhost" },
  },
  {
    name: "SafeNames",
    domain: "safenames.net",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "safenames" },
  },
  {
    name: "easyDNS",
    domain: "easydns.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "easydns" },
  },
  {
    name: "One.com",
    domain: "one.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "one.com" },
  },
  {
    name: "NameSilo",
    domain: "namesilo.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "namesilo" },
  },
  {
    name: "Name SRS",
    domain: "namesrs.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "namesrs" },
  },
  {
    name: "Lexsynergy",
    domain: "lexsynergy.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "lexsynergy" },
  },
  {
    name: "101domain",
    domain: "101domain.com",
    category: "registrar",
    rule: { kind: "registrarIncludes", substr: "101domain" },
  },
];
