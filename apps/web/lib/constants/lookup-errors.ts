import type { LookupError } from "@domainstack/core/lookup";

/**
 * User-facing message for each lookup error, shared by the report UI and the
 * chat tools. Exhaustive so a new `LookupError` code can't ship without wording.
 */
const LOOKUP_ERROR_MESSAGES: Record<LookupError, string> = {
  dns_error: "The domain could not be resolved. It may not exist or DNS is misconfigured.",
  tls_error: "A secure connection to the domain could not be established.",
  unsupported_tld: "Registration lookups aren't supported for this TLD.",
  lookup_failed: "Unable to fetch data. Please try again.",
  fetch_failed: "Unable to fetch data. Please try again.",
};

/**
 * Message for a lookup error. Falls back to the generic one for a code this
 * build doesn't know, since an older client can receive a code a newer server
 * added.
 */
export function getLookupErrorMessage(error: LookupError): string {
  return LOOKUP_ERROR_MESSAGES[error] ?? LOOKUP_ERROR_MESSAGES.fetch_failed;
}
