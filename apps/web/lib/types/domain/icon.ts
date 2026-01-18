/**
 * Icon types - Plain TypeScript interfaces.
 *
 * Shared response type for icon assets (favicons, provider logos, screenshots).
 * These are simple URL-only responses for cached icon data.
 */

/**
 * Response from icon fetch operations.
 */
export interface IconResponse {
  url: string | null;
}

/**
 * Semantic alias for favicon responses.
 */
export type FaviconResponse = IconResponse;

/**
 * Semantic alias for provider logo responses.
 */
export type ProviderLogoResponse = IconResponse;
