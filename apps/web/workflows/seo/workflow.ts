import type { SeoResponse } from "@domainstack/types";
import type { WorkflowResult } from "@/lib/workflow/types";
import { checkBlocklist } from "@/workflows/shared/check-blocklist";
import {
  buildSeoResponseStep,
  fetchHtmlStep,
  fetchRobotsStep,
  persistSeoStep,
  processOgImageStep,
} from "@/workflows/shared/seo";

export interface SeoWorkflowInput {
  domain: string;
}

export type SeoWorkflowResult = WorkflowResult<SeoResponse>;

/**
 * Durable SEO workflow that breaks down SEO data fetching into
 * independently retryable steps:
 * 1. Fetch HTML and parse meta tags
 * 2. Fetch and parse robots.txt
 * 3. Fetch and store OG image (if present)
 * 4. Build response from fetch results
 * 5. Persist to database (creates domain record if needed)
 *
 * Revalidation is handled by SWR (stale-while-revalidate) pattern at the
 * data access layer - when stale data is accessed, a background refresh
 * is triggered automatically.
 */
export async function seoWorkflow(
  input: SeoWorkflowInput,
): Promise<SeoWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch HTML and parse meta
  const htmlResult = await fetchHtmlStep(domain);

  // Step 2: Fetch robots.txt
  const robotsResult = await fetchRobotsStep(domain);

  // Step 3: Process OG image (if present and not blocked)
  let uploadedImageUrl: string | null = null;
  if (htmlResult.preview?.image) {
    // Step 3a: Check blocklist (shared step)
    const isBlocked = await checkBlocklist(domain);

    if (!isBlocked) {
      // Step 3b: Process and store image
      const imageResult = await processOgImageStep(
        domain,
        htmlResult.preview.image,
        htmlResult.finalUrl,
      );
      uploadedImageUrl = imageResult.url;
    }
  }

  // Step 4: Build response from fetch results
  const response = await buildSeoResponseStep(
    htmlResult,
    robotsResult,
    uploadedImageUrl,
  );

  // Step 5: Persist to database
  await persistSeoStep(domain, response, uploadedImageUrl);

  return {
    success: true,
    data: response,
  };
}
