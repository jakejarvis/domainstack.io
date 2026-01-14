/**
 * SEO shared step types.
 *
 * Internal types for step-to-step data transfer and typed errors.
 * Response types (SeoResponse) remain in lib/types/domain/seo.ts.
 */

import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsTxt,
  SeoResponse,
  TwitterMeta,
} from "@/lib/types/domain/seo";

/**
 * Typed error for SEO operations.
 * SEO doesn't have permanent typed errors - all failures are either
 * retryable or partial (e.g., robots fetch can fail while HTML succeeds).
 *
 * For simplicity, we use a generic error type.
 */
export type SeoError = "fetch_failed";

/**
 * Internal data structure for HTML fetch step result.
 */
export interface HtmlFetchData {
  success: boolean;
  finalUrl: string;
  status: number | null;
  meta: {
    openGraph: OpenGraphMeta;
    twitter: TwitterMeta;
    general: GeneralMeta;
  } | null;
  preview: {
    title: string | null;
    description: string | null;
    image: string | null;
    canonicalUrl: string;
  } | null;
  error?: string;
  shouldRetry?: boolean;
}

/**
 * Internal data structure for robots fetch step result.
 */
export interface RobotsFetchData {
  robots: RobotsTxt | null;
  error?: string;
}

/**
 * Internal data structure for persist step input.
 * Contains the built SeoResponse and optional uploaded image URL.
 */
export interface SeoPersistData {
  response: SeoResponse;
  uploadedImageUrl: string | null;
}
