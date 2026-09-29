/**
 * Lightweight provider reference for identification.
 * Used across hosting, certificates, and registration responses.
 */
export interface ProviderRef {
  id: string | null;
  name: string | null;
  domain: string | null;
  /**
   * Cached logo URL, attached by the API for report sections:
   * string = logo, null = known to have none, undefined = unknown (the client fetches it).
   */
  logoUrl?: string | null;
}
