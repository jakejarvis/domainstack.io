import type { VerificationMethod } from "@/lib/constants/verification";

export interface VerificationResult {
  verified: boolean;
  method: VerificationMethod | null;
}

/**
 * Step: Verify domain ownership via DNS TXT record.
 */
export async function verifyDomainByDns(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  "use step";

  const { verifyByDns } = await import("@/lib/verification");
  return await verifyByDns(domain, token);
}

/**
 * Step: Verify domain ownership via HTML file.
 */
export async function verifyDomainByHtmlFile(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  "use step";

  const { verifyByHtmlFile } = await import("@/lib/verification");
  return await verifyByHtmlFile(domain, token);
}

/**
 * Step: Verify domain ownership via meta tag.
 */
export async function verifyDomainByMetaTag(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  "use step";

  const { verifyByMetaTag } = await import("@/lib/verification");
  return await verifyByMetaTag(domain, token);
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
