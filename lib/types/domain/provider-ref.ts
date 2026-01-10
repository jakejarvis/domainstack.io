/**
 * Lightweight provider reference for identification.
 * Used across hosting, certificates, and registration responses.
 */
export interface ProviderRef {
  id: string | null;
  name: string | null;
  domain: string | null;
}
