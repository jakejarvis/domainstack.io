import { isValidVerificationMethod } from "@/lib/verification-instructions";
import type { ResumeDomainData } from "@domainstack/types";

/**
 * Parse `?resume=true&id=…` search params into resume data for the add-domain flow.
 * Invalid or missing verification methods are dropped rather than rejected.
 */
export function parseResumeDomain(
  searchParams: Pick<URLSearchParams, "get"> | null | undefined,
): ResumeDomainData | null {
  if (!searchParams) {
    return null;
  }

  const isResume = searchParams.get("resume") === "true";
  const id = searchParams.get("id");
  const domain = searchParams.get("domain");
  const methodParam = searchParams.get("method");
  const method = isValidVerificationMethod(methodParam) ? methodParam : null;

  if (isResume && id) {
    return {
      id,
      domainName: domain ?? "",
      verificationToken: "",
      verificationMethod: method,
    };
  }

  return null;
}
