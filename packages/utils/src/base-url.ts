/**
 * The app's public origin, from NEXT_PUBLIC_BASE_URL. Throws when unset so a
 * misconfigured deployment fails loudly instead of emailing broken or
 * production links.
 */
export function getBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_BASE_URL is not set");
  }
  return baseUrl;
}
