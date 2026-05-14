/**
 * Supported pricing registrars shown on the unregistered-domain card.
 * Icons stay app-local — they're presentation, not data.
 */
export type RegistrarKey = "porkbun" | "cloudflare" | "dynadot";

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
