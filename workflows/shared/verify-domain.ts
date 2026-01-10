import type { VerificationMethod } from "@/lib/constants/verification";

export interface VerificationResult {
  verified: boolean;
  method: VerificationMethod | null;
}

/**
 * Step: Verify domain ownership by trying all methods in order.
 * Returns on first successful verification.
 *
 * This is a durable workflow step that wraps the verification logic.
 */
export async function verifyDomainOwnership(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  "use step";

  const { verifyDomain } = await import("@/lib/verification");
  return await verifyDomain(domain, token);
}

/**
 * Step: Verify domain ownership using a specific method only.
 *
 * This is a durable workflow step that wraps the verification logic.
 */
export async function verifyDomainOwnershipByMethod(
  domain: string,
  token: string,
  method: VerificationMethod,
): Promise<VerificationResult> {
  "use step";

  const { verifyDomainByMethod } = await import("@/lib/verification");
  return await verifyDomainByMethod(domain, token, method);
}
