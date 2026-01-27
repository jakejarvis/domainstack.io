/**
 * SEO normalize step.
 *
 * Builds the SeoResponse from fetch results.
 * This step is shared between the dedicated seoWorkflow and internal workflows.
 */

import type { SeoResponse } from "@domainstack/types";
import type { HtmlFetchData, RobotsFetchData } from "./types";

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

  return {
    meta: htmlData.meta,
    robots: robotsData.robots,
    preview: htmlData.preview
      ? {
          ...htmlData.preview,
          imageUploaded: uploadedImageUrl,
        }
      : null,
    source: {
      finalUrl: htmlData.finalUrl,
      status: htmlData.status,
    },
    ...(htmlData.error || robotsData.error
      ? {
          errors: {
            ...(htmlData.error ? { html: htmlData.error } : {}),
            ...(robotsData.error ? { robots: robotsData.error } : {}),
          },
        }
      : {}),
  };
}
