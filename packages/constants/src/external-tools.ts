/**
 * Third-party domain inspection tools surfaced by the "Open in…" menus.
 * Entries are sorted alphabetically (case-insensitive) so callers can
 * iterate in source order.
 */
export interface ExternalTool {
  name: string;
  /** Domain used to fetch this tool's favicon for the menu. */
  faviconDomain: string;
  buildUrl: (domain: string) => string;
}

export const EXTERNAL_TOOLS: readonly ExternalTool[] = [
  {
    name: "BuiltWith",
    faviconDomain: "builtwith.com",
    buildUrl: (domain) => `https://builtwith.com/${encodeURIComponent(domain)}`,
  },
  {
    name: "Censys",
    faviconDomain: "censys.io",
    buildUrl: (domain) =>
      `https://search.censys.io/search?resource=hosts&q=${encodeURIComponent(domain)}`,
  },
  {
    name: "Cloudflare Radar",
    faviconDomain: "cloudflare.com",
    buildUrl: (domain) =>
      `https://radar.cloudflare.com/domains/domain/${encodeURIComponent(domain)}`,
  },
  {
    name: "crt.sh",
    faviconDomain: "crt.sh",
    buildUrl: (domain) => `https://crt.sh/?q=${encodeURIComponent(domain)}`,
  },
  {
    name: "DNSViz",
    faviconDomain: "dnsviz.net",
    buildUrl: (domain) => `https://dnsviz.net/d/${encodeURIComponent(domain)}/dnssec/`,
  },
  {
    name: "DomainTools",
    faviconDomain: "domaintools.com",
    buildUrl: (domain) => `https://whois.domaintools.com/${encodeURIComponent(domain)}`,
  },
  {
    name: "IBM X-Force",
    faviconDomain: "exchange.xforce.ibmcloud.com",
    buildUrl: (domain) => `https://exchange.xforce.ibmcloud.com/url/${encodeURIComponent(domain)}`,
  },
  {
    name: "Internet.nl",
    faviconDomain: "internet.nl",
    buildUrl: (domain) => `https://internet.nl/site/${encodeURIComponent(domain)}/`,
  },
  {
    name: "intoDNS",
    faviconDomain: "intodns.com",
    buildUrl: (domain) => `https://intodns.com/${encodeURIComponent(domain)}`,
  },
  {
    name: "Is Agentic",
    faviconDomain: "is-agentic.com",
    buildUrl: (domain) => `https://is-agentic.com/scan/${encodeURIComponent(domain)}`,
  },
  {
    name: "Mozilla Observatory",
    faviconDomain: "mozilla.org",
    buildUrl: (domain) =>
      `https://developer.mozilla.org/en-US/observatory/analyze?host=${encodeURIComponent(domain)}`,
  },
  {
    name: "MxToolbox",
    faviconDomain: "mxtoolbox.com",
    buildUrl: (domain) =>
      `https://mxtoolbox.com/SuperTool.aspx?action=mx%3a${encodeURIComponent(domain)}&run=toolpage`,
  },
  {
    name: "Open Threat Exchange",
    faviconDomain: "levelblue.com",
    buildUrl: (domain) =>
      `https://otx.alienvault.com/indicator/domain/${encodeURIComponent(domain)}`,
  },
  {
    name: "PageSpeed Insights",
    faviconDomain: "pagespeed.web.dev",
    buildUrl: (domain) =>
      `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`https://${domain}/`)}`,
  },
  {
    name: "Security Headers",
    faviconDomain: "securityheaders.io",
    buildUrl: (domain) =>
      `https://securityheaders.com/?q=${encodeURIComponent(`https://${domain}`)}&hide=on&followRedirects=on`,
  },
  {
    name: "SecurityTrails",
    faviconDomain: "securitytrails.com",
    buildUrl: (domain) => `https://securitytrails.com/domain/${encodeURIComponent(domain)}/dns`,
  },
  {
    name: "Sharing Debugger",
    faviconDomain: "facebook.com",
    buildUrl: (domain) =>
      `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(`https://${domain}`)}`,
  },
  {
    name: "Shodan",
    faviconDomain: "shodan.io",
    buildUrl: (domain) =>
      `https://www.shodan.io/search?query=hostname:${encodeURIComponent(domain)}`,
  },
  {
    name: "SSL Labs",
    faviconDomain: "ssllabs.com",
    buildUrl: (domain) =>
      `https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(domain)}&hideResults=on`,
  },
  {
    name: "Traffic.cv",
    faviconDomain: "traffic.cv",
    buildUrl: (domain) => `https://traffic.cv/${encodeURIComponent(domain)}`,
  },
  {
    name: "urlscan.io",
    faviconDomain: "urlscan.io",
    buildUrl: (domain) => `https://urlscan.io/search/#domain:${encodeURIComponent(domain)}`,
  },
  {
    name: "VirusTotal",
    faviconDomain: "virustotal.com",
    buildUrl: (domain) =>
      `https://www.virustotal.com/gui/domain/${encodeURIComponent(domain)}/relations`,
  },
  {
    name: "Wayback Machine",
    faviconDomain: "web.archive.org",
    buildUrl: (domain) => `https://web.archive.org/web/*/${encodeURIComponent(domain)}`,
  },
  {
    name: "What's My DNS?",
    faviconDomain: "whatsmydns.net",
    buildUrl: (domain) => `https://www.whatsmydns.net/#A/${encodeURIComponent(domain)}`,
  },
];
