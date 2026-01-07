/**
 * SEO types - Plain TypeScript interfaces.
 */

import type {
  SOCIAL_PREVIEW_PROVIDERS,
  SOCIAL_PREVIEW_VARIANTS,
} from "@/lib/constants/seo";

export type SocialPreviewProvider = (typeof SOCIAL_PREVIEW_PROVIDERS)[number];
export type SocialPreviewVariant = (typeof SOCIAL_PREVIEW_VARIANTS)[number];

/**
 * Robots.txt rule.
 */
export type RobotsRule =
  | { type: "allow"; value: string }
  | { type: "disallow"; value: string }
  | { type: "crawlDelay"; value: string }
  | { type: "contentSignal"; value: string };

/**
 * Robots.txt user-agent group.
 */
export interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
}

/**
 * Parsed robots.txt data.
 */
export interface RobotsTxt {
  fetched: boolean;
  groups: RobotsGroup[];
  sitemaps: string[];
}

/**
 * OpenGraph meta tags.
 */
export interface OpenGraphMeta {
  title?: string;
  description?: string;
  type?: string;
  url?: string;
  siteName?: string;
  images?: string[];
}

/**
 * Twitter card meta tags.
 */
export interface TwitterMeta {
  card?: string;
  title?: string;
  description?: string;
  image?: string;
}

/**
 * General HTML meta tags.
 */
export interface GeneralMeta {
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
  canonical?: string;
  generator?: string;
  robots?: string;
}

/**
 * Combined SEO meta tags.
 */
export interface SeoMeta {
  openGraph: OpenGraphMeta;
  twitter: TwitterMeta;
  general: GeneralMeta;
}

/**
 * SEO preview data for social sharing.
 */
export interface SeoPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  imageUploaded?: string | null;
  canonicalUrl: string;
}

/**
 * Full SEO response.
 */
export interface SeoResponse {
  meta: SeoMeta | null;
  robots: RobotsTxt | null;
  preview: SeoPreview | null;
  source: {
    finalUrl: string | null;
    status: number | null;
  };
  errors?: {
    html?: string;
    robots?: string;
  };
}
