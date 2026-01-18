import type { CertificatesResponse } from "@/lib/types/domain/certificates";
import type { WorkflowResult } from "@/lib/workflow/types";
import {
  type CertificatesError,
  fetchCertificateChainStep,
  persistCertificatesStep,
  processChainStep,
} from "@/workflows/shared/certificates";
import { scheduleRevalidationBatchStep } from "@/workflows/shared/schedule-batch";

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
 * 4. Schedule revalidation
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
  const { lastAccessedAt } = await persistCertificatesStep(
    domain,
    processedResult,
  );

  // Step 4: Schedule revalidation
  await scheduleRevalidationBatchStep(domain, ["certificates"], lastAccessedAt);

  return {
    success: true,
    data: { certificates: processedResult.certificates },
  };
}
