import type { CertificatesResponse } from "@/lib/types/domain/certificates";
import type { WorkflowResult } from "@/lib/workflow/types";
import {
  type CertificatesError,
  fetchCertificateChainStep,
  persistCertificatesStep,
  processChainStep,
} from "@/workflows/shared/certificates";

export interface CertificatesWorkflowInput {
  domain: string;
}

export type CertificatesWorkflowResult = WorkflowResult<
  CertificatesResponse,
  CertificatesError
>;

/**
 * Durable certificates workflow that breaks down TLS certificate fetching into
 * independently retryable steps:
 * 1. Fetch certificate chain (TLS handshake - the slow operation)
 * 2. Detect CA providers
 * 3. Persist to database
 *
 * Revalidation is handled by SWR (stale-while-revalidate) pattern at the
 * data access layer - when stale data is accessed, a background refresh
 * is triggered automatically.
 */
export async function certificatesWorkflow(
  input: CertificatesWorkflowInput,
): Promise<CertificatesWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch certificate chain via TLS handshake
  const tlsResult = await fetchCertificateChainStep(domain);

  if (!tlsResult.success) {
    return {
      success: false,
      error: tlsResult.error,
      data: null,
    };
  }

  // Step 2: Detect CA providers and build response
  const processedResult = await processChainStep(tlsResult.data.chainJson);

  // Step 3: Persist to database
  await persistCertificatesStep(domain, processedResult);

  return {
    success: true,
    data: { certificates: processedResult.certificates },
  };
}
