import type { VerificationMethod } from "@/lib/types";

export type { VerificationResult } from "@/lib/verification";

/**
 * Step: Verify domain ownership by trying all methods in order.
 * Returns on first successful verification.
 *
 * This is a durable workflow step that wraps the verification logic.
 */
export async function verifyDomainOwnership(
  domain: string,
  token: string,
): Promise<{ verified: boolean; method: VerificationMethod | null }> {
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
): Promise<{ verified: boolean; method: VerificationMethod | null }> {
  "use step";

  const { verifyDomainByMethod } = await import("@/lib/verification");
  return await verifyDomainByMethod(domain, token, method);
}
