import {
  CloudflareIcon,
  DynadotIcon,
  PorkbunIcon,
} from "@/components/brand-icons";

/**
 * Provider configuration for domain pricing.
 * Shared between server-side pricing service and client-side CTA rendering.
 */

export interface PricingProviderInfo {
  /** Provider display name */
  name: string;
  /** Generate registration URL for a domain */
  searchUrl: (domain: string) => string;
  /** Provider icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Whether icon needs white background or is transparent */
  transparentIcon?: boolean;
}

/**
 * Registry of all supported pricing providers.
 * Add new providers here and they'll automatically appear in the CTA.
 */
export const PRICING_PROVIDERS: Record<string, PricingProviderInfo> = {
  porkbun: {
    name: "Porkbun",
    searchUrl: (domain) => `https://porkbun.com/checkout/search?q=${domain}`,
    icon: PorkbunIcon,
    transparentIcon: false,
  },
  cloudflare: {
    name: "Cloudflare Registrar",
    searchUrl: (domain) => `https://domains.cloudflare.com/?domain=${domain}`,
    icon: CloudflareIcon,
    transparentIcon: true,
  },
  dynadot: {
    name: "Dynadot",
    searchUrl: (domain) =>
      `https://www.dynadot.com/domain/search?domain=${domain}`,
    icon: DynadotIcon,
    transparentIcon: false,
  },
} as const;
