import type { RegistrationResponse } from "@domainstack/types";

/**
 * Step: Normalize registrar and build response.
 *
 * @param recordJson - JSON-serialized RDAP/WHOIS record
 * @returns Normalized RegistrationResponse
 */
export async function normalizeAndBuildResponseStep(
  recordJson: string,
): Promise<RegistrationResponse> {
  "use step";

  const { getProviderCatalog } = await import("@domainstack/edge-config");
  const { normalizeRegistration } = await import("@domainstack/server/services/registration");
  return await normalizeRegistration(recordJson, { catalog: await getProviderCatalog() });
}
