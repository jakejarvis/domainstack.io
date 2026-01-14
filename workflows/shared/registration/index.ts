/**
 * Registration shared steps.
 *
 * Re-exports fetch, normalize, and persist steps along with types.
 */

export { lookupWhoisStep } from "./fetch";
export { normalizeAndBuildResponseStep } from "./normalize";
export { persistRegistrationStep } from "./persist";
export type {
  FetchRegistrationResult,
  RegistrationError,
  RegistrationFetchData,
} from "./types";
