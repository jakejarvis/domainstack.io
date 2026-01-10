import type { VerificationMethod } from "@/lib/constants/verification";
import { VERIFICATION_METHODS } from "@/lib/constants/verification";
import {
  verifyDomainOwnership,
  verifyDomainOwnershipByMethod,
} from "@/workflows/shared/verify-domain";

export interface VerificationWorkflowInput {
  domain: string;
  token: string;
  /** If specified, only try this method. Otherwise try all methods. */
  method?: VerificationMethod;
}

export type VerificationWorkflowResult =
  | {
      success: true;
      data: { verified: boolean; method: VerificationMethod | null };
    }
  | {
      success: false;
      error?: string;
      data: { verified: false; method: null };
    };

/**
 * Durable verification workflow that checks domain ownership
 * using DNS TXT records, HTML files, or meta tags.
 *
 * This workflow is a thin wrapper around the shared verification steps.
 * New code should prefer calling the shared steps directly:
 * - `verifyDomainOwnership()` - try all methods
 * - `verifyDomainOwnershipByMethod()` - try specific method
 */
export async function verificationWorkflow(
  input: VerificationWorkflowInput,
): Promise<VerificationWorkflowResult> {
  "use workflow";

  const { domain, token, method } = input;

  // If a specific method is requested, only try that one
  if (method) {
    // Validate method before attempting verification
    if (!VERIFICATION_METHODS.includes(method)) {
      return {
        success: false,
        error: "Unknown method",
        data: { verified: false, method: null },
      };
    }

    const result = await verifyDomainOwnershipByMethod(domain, token, method);
    return {
      success: true,
      data: result,
    };
  }

  // Try all methods in order of reliability
  const result = await verifyDomainOwnership(domain, token);
  return {
    success: true,
    data: result,
  };
}

/**
 * Generate a secure verification token.
 * This is a pure function that doesn't need to be a workflow step.
 */
export function generateVerificationToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
