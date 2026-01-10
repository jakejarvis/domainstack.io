import { FatalError, RetryableError } from "workflow";
import type {
  Certificate,
  CertificatesResponse,
} from "@/lib/types/domain/certificates";

export interface CertificatesWorkflowInput {
  domain: string;
}

export type CertificatesWorkflowResult =
  | {
      success: true;
      data: CertificatesResponse;
    }
  | {
      success: false;
      error: "dns_error" | "tls_error" | "timeout" | "connection_failed";
      data: CertificatesResponse | null;
    };

// Internal types for step-to-step transfer
interface RawCertificate {
  issuer: string;
  subject: string;
  altNames: string[];
  validFrom: string;
  validTo: string;
}

interface TlsFetchSuccess {
  success: true;
  chainJson: string;
}

interface TlsFetchFailure {
  success: false;
  isDnsError: boolean;
  isTlsError: boolean;
}

type TlsFetchResult = TlsFetchSuccess | TlsFetchFailure;

/**
 * Durable certificates workflow that breaks down TLS certificate fetching into
 * independently retryable steps:
 * 1. Fetch certificate chain (TLS handshake - the slow operation)
 * 2. Detect CA providers
 * 3. Persist to database
 */
export async function certificatesWorkflow(
  input: CertificatesWorkflowInput,
): Promise<CertificatesWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch certificate chain via TLS handshake
  const tlsResult = await fetchCertificateChainStep(domain);

  if (!tlsResult.success) {
    const errorType = tlsResult.isDnsError
      ? "dns_error"
      : tlsResult.isTlsError
        ? "tls_error"
        : "connection_failed";

    return {
      success: false,
      error: errorType,
      data: {
        certificates: [],
        ...(tlsResult.isTlsError && { error: "Invalid SSL certificate" }),
      },
    };
  }

  // Step 2: Detect CA providers and build response
  const processedResult = await detectProvidersAndBuildResponseStep(
    tlsResult.chainJson,
  );

  // Step 3: Persist to database
  await persistCertificatesStep(domain, processedResult);

  return {
    success: true,
    data: { certificates: processedResult.certificates },
  };
}

/**
 * Step: Fetch certificate chain via TLS handshake
 */
async function fetchCertificateChainStep(
  domain: string,
): Promise<TlsFetchResult> {
  "use step";

  const { fetchCertificateChain } = await import(
    "@/lib/domain/certificates-lookup"
  );

  const result = await fetchCertificateChain(domain);

  if (!result.success) {
    if (result.error === "fetch_error") {
      throw new RetryableError("Certificate fetch failed", {
        retryAfter: "5s",
      });
    }
    return {
      success: false,
      isDnsError: result.error === "dns_error",
      isTlsError: result.error === "tls_error",
    };
  }

  return { success: true, chainJson: JSON.stringify(result.chain) };
}

// TLS handshakes can be flaky - allow more retries
fetchCertificateChainStep.maxRetries = 5;

/**
 * Step: Detect CA providers from issuer names and build response
 */
async function detectProvidersAndBuildResponseStep(chainJson: string): Promise<{
  certificates: Certificate[];
  providerIds: (string | null)[];
  earliestValidTo: Date;
}> {
  "use step";

  const { processCertificateChain } = await import(
    "@/lib/domain/certificates-lookup"
  );

  const chain = JSON.parse(chainJson) as RawCertificate[];
  return await processCertificateChain(chain);
}

/**
 * Step: Persist certificates to database
 */
async function persistCertificatesStep(
  domain: string,
  result: {
    certificates: Certificate[];
    providerIds: (string | null)[];
    earliestValidTo: Date;
  },
): Promise<void> {
  "use step";

  const { persistCertificatesData } = await import(
    "@/lib/domain/certificates-lookup"
  );
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "certificates-workflow" });

  try {
    await persistCertificatesData(domain, result);
  } catch (err) {
    logger.error({ err, domain }, "failed to persist certificates");
    throw new FatalError("Failed to persist certificates");
  }
}
