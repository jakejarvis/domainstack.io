import type { SeoResponse } from "@/lib/types/domain/seo";

export interface FetchSeoResult {
  success: boolean;
  data: SeoResponse | null;
  error?: string;
}

/**
 * Shared step: Fetch and persist SEO data for a domain.
 *
 * This step can be called from any workflow to fetch SEO/meta data
 * with full durability and retry semantics.
 */
export async function fetchSeoData(domain: string): Promise<FetchSeoResult> {
  "use step";

  const { lookupAndPersistSeo } = await import("@/lib/domain/seo-lookup");

  const result = await lookupAndPersistSeo(domain);

  if (!result) {
    return { success: false, data: null, error: "SEO fetch failed" };
  }

  return {
    success: true,
    data: result,
  };
}
