import {
  CloudflareIcon,
  DynadotIcon,
  PorkbunIcon,
} from "@/components/brand-icons";
import type { PricingProviderInfo } from "@/lib/types";

/**
 * Provider constants for domain pricing.
 * Types are in @/lib/types/pricing.ts.
 */

/**
 * Registry of all supported pricing providers.
 * Add new providers here and they'll automatically appear in the CTA.
 */
export const PRICING_PROVIDERS: Record<string, PricingProviderInfo> = {
  porkbun: {
    name: "Porkbun",
    searchUrl: (domain) => `https://porkbun.com/checkout/search?q=${domain}`,
    icon: PorkbunIcon,
  },
  cloudflare: {
    name: "Cloudflare Registrar",
    searchUrl: (domain) => `https://domains.cloudflare.com/?domain=${domain}`,
    icon: CloudflareIcon,
  },
  dynadot: {
    name: "Dynadot",
    searchUrl: (domain) =>
      `https://www.dynadot.com/domain/search?domain=${domain}`,
    icon: DynadotIcon,
  },
} as const;
