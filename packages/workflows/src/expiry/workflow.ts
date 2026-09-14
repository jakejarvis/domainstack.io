import { requireSettled } from "../lib/settled";
import { checkCertificateExpiry } from "./certificate";
import { checkDomainExpiry } from "./domain";

interface ExpiryWorkflowInput {
  trackedDomainId: string;
}

/**
 * Durable workflow to check both domain registration and TLS certificate
 * expiry for a tracked domain, sending notifications based on user
 * preferences.
 *
 * The two branches run independently and both settle before either result
 * (or an exhausted required failure) is reported, so one branch's retries
 * never block the other's.
 */
export async function expiryWorkflow(input: ExpiryWorkflowInput) {
  "use workflow";

  const [domain, certificate] = await Promise.allSettled([
    checkDomainExpiry(input),
    checkCertificateExpiry(input),
  ]);

  return {
    domain: requireSettled(domain),
    certificate: requireSettled(certificate),
  };
}
