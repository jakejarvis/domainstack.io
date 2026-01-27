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
  TwitterMeta,
} from "@domainstack/types";

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
