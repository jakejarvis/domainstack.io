import { CloudflareIcon, PorkbunIcon } from "@/components/brand-icons";

/**
 * Provider configuration for domain pricing.
 * Shared between server-side pricing service and client-side CTA rendering.
 */

export interface PricingProviderInfo {
  /** Provider display name */
  name: string;
  /** Provider icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Generate registration URL for a domain */
  url: (domain: string) => string;
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
    icon: PorkbunIcon,
    url: (domain) => `https://porkbun.com/checkout/search?q=${domain}`,
    transparentIcon: false,
  },
  cloudflare: {
    name: "Cloudflare Registrar",
    icon: CloudflareIcon,
    url: (domain) => `https://domains.cloudflare.com/?domain=${domain}`,
    transparentIcon: true,
  },
} as const;

/**
 * Type-safe provider keys
 */
export type PricingProviderKey = keyof typeof PRICING_PROVIDERS;
