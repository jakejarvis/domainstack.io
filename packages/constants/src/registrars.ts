/**
 * Supported pricing registrars shown on the unregistered-domain card.
 * Icons stay app-local — they're presentation, not data.
 */
export const REGISTRAR_KEYS = ["porkbun", "cloudflare", "dynadot"] as const;

type RegistrarKey = (typeof REGISTRAR_KEYS)[number];

export interface RegistrarProvider {
  name: string;
  searchUrl: (domain: string) => string;
}

export const REGISTRAR_PROVIDERS: Record<RegistrarKey, RegistrarProvider> = {
  porkbun: {
    name: "Porkbun",
    searchUrl: (domain) => `https://porkbun.com/checkout/search?q=${domain}`,
  },
  cloudflare: {
    name: "Cloudflare Registrar",
    searchUrl: (domain) => `https://domains.cloudflare.com/?domain=${domain}`,
  },
  dynadot: {
    name: "Dynadot",
    searchUrl: (domain) => `https://www.dynadot.com/domain/search?domain=${domain}`,
  },
};
