import type { RegistrationResponse } from "@domainstack/types";

/**
 * Step: Persist registration to database.
 *
 * @param domain - The domain name
 * @param response - The normalized registration response
 */
export async function persistRegistrationStep(
  domain: string,
  response: RegistrationResponse,
): Promise<void> {
  "use step";

  const { persistRegistration } = await import("@domainstack/server/services/registration");
  try {
    await persistRegistration(domain, response);
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, { context: `persisting registration for ${domain}` });
  }
}
