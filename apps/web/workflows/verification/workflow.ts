import type { VerificationMethod } from "@domainstack/constants";
import { VERIFICATION_METHODS } from "@domainstack/constants";
import {
  verifyDomainByDns,
  verifyDomainByHtmlFile,
  verifyDomainByMetaTag,
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
 * Each verification method runs as a separate workflow step for better
 * observability and debugging. Methods are tried in order of reliability:
 * 1. DNS TXT record (most reliable)
 * 2. HTML file
 * 3. Meta tag
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

  // Try DNS first (most reliable)
  const dnsResult = await verifyDomainByDns(domain, token);
  if (dnsResult.verified) {
    return {
      success: true,
      data: dnsResult,
    };
  }

  // Try HTML file
  const htmlResult = await verifyDomainByHtmlFile(domain, token);
  if (htmlResult.verified) {
    return {
      success: true,
      data: htmlResult,
    };
  }

  // Try meta tag
  const metaResult = await verifyDomainByMetaTag(domain, token);
  if (metaResult.verified) {
    return {
      success: true,
      data: metaResult,
    };
  }

  // None of the methods succeeded
  return {
    success: true,
    data: { verified: false, method: null },
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
