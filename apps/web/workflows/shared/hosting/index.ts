/**
 * Hosting shared steps.
 *
 * Re-exports detect and persist steps along with types.
 */

export { detectAndResolveProvidersStep, lookupGeoIpStep } from "./detect";
export { persistHostingStep } from "./persist";
export type { ProviderDetectionData } from "./types";
