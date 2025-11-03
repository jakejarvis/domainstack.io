import type { Provider } from "@/lib/schemas";

/**
 * A registry of known DNS providers. The detection algorithm will iterate
 * through this list to identify the DNS provider from NS records.
 */
export const DNS_PROVIDERS: Array<
  Omit<Provider, "category"> & { category: "dns" }
> = [
  {
    name: "Cloudflare",
    domain: "cloudflare.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "cloudflare.com" },
  },
  {
    name: "Vercel",
    domain: "vercel.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "vercel-dns.com" },
  },
  {
    name: "DNSimple",
    domain: "dnsimple.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "dnsimple.com" },
        { kind: "nsSuffix", suffix: "dnsimple-edge.net" },
        { kind: "nsSuffix", suffix: "dnsimple-edge.org" },
      ],
    },
  },
  {
    name: "WordPress.com",
    domain: "wordpress.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "wordpress.com" },
  },
  {
    name: "DNS Made Easy",
    domain: "dnsmadeeasy.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "dnsmadeeasy.com" },
        { kind: "nsSuffix", suffix: "constellix.com" },
        { kind: "nsSuffix", suffix: "constellix.net" },
      ],
    },
  },
  {
    name: "DigitalOcean",
    domain: "digitalocean.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "digitalocean.com" },
  },
  {
    name: "NS1",
    domain: "ns1.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "nsone.net" },
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
  {
    name: "GoDaddy",
    domain: "godaddy.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "domaincontrol.com" },
  },
  {
    name: "Google Cloud DNS",
    domain: "cloud.google.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "googledomains.com" },
        { kind: "nsSuffix", suffix: "google.com" },
      ],
    },
  },
  {
    name: "Hurricane Electric",
    domain: "he.net",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "he.net" },
  },
  {
    name: "Linode",
    domain: "linode.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "linode.com" },
  },
  {
    name: "Hetzner",
    domain: "hetzner.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "hetzner.de" },
        { kind: "nsSuffix", suffix: "hetzner.com" },
      ],
    },
  },
  {
    name: "OVHcloud",
    domain: "ovhcloud.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "ovh.net" },
        { kind: "nsSuffix", suffix: "ovh.co.uk" },
      ],
    },
  },
  {
    name: "1&1 IONOS",
    domain: "ionos.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "ionos.com" },
        { kind: "nsSuffix", suffix: "1and1.com" },
      ],
    },
  },
  {
    name: "NameSilo",
    domain: "namesilo.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "namesilo.com" },
  },
  {
    name: "DreamHost",
    domain: "dreamhost.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "dreamhost.com" },
  },
  {
    name: "Squarespace",
    domain: "squarespace.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "squarespacedns.com" },
  },
  {
    name: "Wix",
    domain: "wix.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "wixdns.net" },
  },
  {
    name: "Microsoft Azure",
    domain: "azure.microsoft.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "azure-dns.com" },
        { kind: "nsSuffix", suffix: "azure-dns.net" },
        { kind: "nsSuffix", suffix: "azure-dns.org" },
        { kind: "nsSuffix", suffix: "azure-dns.info" },
      ],
    },
  },
  {
    name: "Namecheap DNS",
    domain: "namecheap.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "registrar-servers.com" },
        { kind: "nsSuffix", suffix: "namecheaphosting.com" },
      ],
    },
  },
  {
    name: "Spaceship",
    domain: "spaceship.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "spaceship.com" },
        { kind: "nsSuffix", suffix: "spaceship.net" },
      ],
    },
  },
  {
    name: "Akamai Edge DNS",
    domain: "akamai.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "akam.net" },
  },
  {
    name: "UltraDNS",
    domain: "vercara.digicert.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "ultradns.com" },
        { kind: "nsSuffix", suffix: "ultradns.net" },
        { kind: "nsSuffix", suffix: "ultradns.org" },
        { kind: "nsSuffix", suffix: "ultradns.co.uk" },
        { kind: "nsSuffix", suffix: "ultradns.biz" },
        { kind: "nsSuffix", suffix: "ultradns.info" },
      ],
    },
  },
  {
    name: "Porkbun DNS",
    domain: "porkbun.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "porkbun.com" },
  },
  {
    name: "AliDNS / HiChina",
    domain: "alibabacloud.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "hichina.com" },
        { kind: "nsSuffix", suffix: "alidns.com" },
      ],
    },
  },
  {
    name: "DNSPod",
    domain: "dnspod.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "dnspod.net" },
  },
  {
    name: "Network Solutions",
    domain: "networksolutions.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "worldnic.com" },
        { kind: "nsSuffix", suffix: "register.com" },
      ],
    },
  },
  {
    name: "Fastmail",
    domain: "fastmail.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "messagingengine.com" },
  },
  {
    name: "Gandi",
    domain: "gandi.net",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "gandi.net" },
  },
  {
    name: "Rackspace DNS",
    domain: "rackspace.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "rackspace.com" },
  },
  {
    name: "easyDNS",
    domain: "easydns.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "easydns.com" },
        { kind: "nsSuffix", suffix: "easydns.net" },
        { kind: "nsSuffix", suffix: "easydns.org" },
        { kind: "nsSuffix", suffix: "easydns.ca" },
        { kind: "nsSuffix", suffix: "easydns.info" },
      ],
    },
  },
  {
    name: "Bunny.net",
    domain: "bunny.net",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "bunny.net" },
  },
  {
    name: "One.com",
    domain: "one.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "one.com" },
  },
  {
    name: "Hover",
    domain: "hover.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "hover.com" },
  },
  {
    name: "ClouDNS",
    domain: "cloudns.net",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "cloudns.net" },
        { kind: "nsSuffix", suffix: "cloudns.uk" },
      ],
    },
  },
  {
    name: "Rage4",
    domain: "rage4.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "r4ns.net" },
  },
  {
    name: "Vultr",
    domain: "vultr.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "vultr.com" },
  },
  {
    name: "Exoscale",
    domain: "exoscale.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "exoscale.com" },
        { kind: "nsSuffix", suffix: "exoscale.net" },
        { kind: "nsSuffix", suffix: "exoscale.io" },
        { kind: "nsSuffix", suffix: "exoscale.ch" },
      ],
    },
  },
  {
    name: "EntryDNS",
    domain: "entrydns.net",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "entrydns.net" },
  },
  {
    name: "Dyn (Oracle)",
    domain: "oracle.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "dns.dyn.com" },
  },
  {
    name: "Oracle Cloud",
    domain: "oracle.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "oraclecloud.net" },
  },
  {
    name: "Afraid.org Free DNS",
    domain: "afraid.org",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "afraid.org" },
  },
  {
    name: "Zoneedit",
    domain: "zoneedit.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "zoneedit.com" },
  },
  {
    name: "Bluehost",
    domain: "bluehost.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "bluehost.com" },
  },
  {
    name: "EuroDNS",
    domain: "eurodns.com",
    category: "dns",
    rule: {
      any: [
        { kind: "nsSuffix", suffix: "eurodns.com" },
        { kind: "nsSuffix", suffix: "eurodns.org" },
        { kind: "nsSuffix", suffix: "eurodns.eu" },
        { kind: "nsSuffix", suffix: "eurodns.biz" },
      ],
    },
  },
  {
    name: "Liquid Web",
    domain: "liquidweb.com",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "liquidweb.com" },
  },
  {
    name: "Nexcess",
    domain: "nexcess.net",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "nexcess.net" },
  },
  {
    name: "Packet Clearing House",
    domain: "pch.net",
    category: "dns",
    rule: { kind: "nsSuffix", suffix: "pch.net" },
  },
];
