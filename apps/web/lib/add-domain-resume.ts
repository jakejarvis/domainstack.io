import type { ResumeDomainData, VerificationMethod } from "@domainstack/types";
import { isValidVerificationMethod } from "@domainstack/utils/verification";

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

/**
 * Link to the add-domain flow that resumes verification of a tracked domain.
 * {@link parseResumeDomain} reads it back.
 */
export function addDomainResumeHref(id: string, method: VerificationMethod | null): string {
  const params = new URLSearchParams({ resume: "true", id });
  if (method) params.set("method", method);
  return `/dashboard/add-domain?${params.toString()}`;
}
