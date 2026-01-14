/**
 * SEO normalize step.
 *
 * Builds the SeoResponse from fetch results.
 * This step is shared between the dedicated seoWorkflow and internal workflows.
 */

import type { SeoResponse } from "@/lib/types/domain/seo";
import type { HtmlFetchData, RobotsFetchData } from "./types";

/**
 * Build SeoResponse from fetch results.
 *
 * This is a pure function that combines HTML, robots, and OG image data
 * into the final SeoResponse format.
 */
function buildSeoResponse(
  htmlResult: HtmlFetchData,
  robotsResult: RobotsFetchData,
  uploadedImageUrl: string | null,
): SeoResponse {
  return {
    meta: htmlResult.meta,
    robots: robotsResult.robots,
    preview: htmlResult.preview
      ? {
          ...htmlResult.preview,
          imageUploaded: uploadedImageUrl,
        }
      : null,
    source: {
      finalUrl: htmlResult.finalUrl,
      status: htmlResult.status,
    },
    ...(htmlResult.error || robotsResult.error
      ? {
          errors: {
            ...(htmlResult.error ? { html: htmlResult.error } : {}),
            ...(robotsResult.error ? { robots: robotsResult.error } : {}),
          },
        }
      : {}),
  };
}

/**
 * Step: Build SeoResponse from fetch results.
 *
 * @param htmlData - Result from fetchHtmlStep
 * @param robotsData - Result from fetchRobotsStep
 * @param uploadedImageUrl - Optional URL of uploaded OG image
 * @returns Complete SeoResponse
 */
export async function buildSeoResponseStep(
  htmlData: HtmlFetchData,
  robotsData: RobotsFetchData,
  uploadedImageUrl: string | null,
): Promise<SeoResponse> {
  "use step";

  return buildSeoResponse(htmlData, robotsData, uploadedImageUrl);
}

// Export for testing
export { buildSeoResponse };
