import type { LookupError } from "@domainstack/core/services/lookup";

/**
 * User-facing message for each lookup error, shared by the report UI and the
 * chat tools. Exhaustive so a new `LookupError` code can't ship without wording.
 */
export const LOOKUP_ERROR_MESSAGES: Record<LookupError, string> = {
  dns_error: "The domain could not be resolved. It may not exist or DNS is misconfigured.",
  tls_error: "A secure connection to the domain could not be established.",
  unsupported_tld: "Registration lookups aren't supported for this TLD.",
  lookup_failed: "Unable to fetch data. Please try again.",
  fetch_failed: "Unable to fetch data. Please try again.",
};
