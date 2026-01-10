import { RetryableError } from "workflow";
import type { RegistrationResponse } from "@/lib/types/domain/registration";

export interface FetchRegistrationResult {
  success: boolean;
  data: RegistrationResponse | null;
  error?: string;
}

/**
 * Shared step: Fetch and persist registration data for a domain.
 *
 * This step can be called from any workflow to fetch WHOIS/RDAP data
 * with full durability and retry semantics.
 */
export async function fetchRegistrationData(
  domain: string,
): Promise<FetchRegistrationResult> {
  "use step";

  const { lookupAndPersistRegistration } = await import(
    "@/lib/domain/registration-lookup"
  );

  const result = await lookupAndPersistRegistration(domain);

  if (!result) {
    // null indicates a retryable condition - throw to leverage durable step retry semantics
    throw new RetryableError("RDAP lookup failed", { retryAfter: "5s" });
  }

  return {
    success: true,
    data: result,
  };
}
