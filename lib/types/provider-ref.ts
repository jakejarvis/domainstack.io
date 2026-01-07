/**
 * Provider reference type - Plain TypeScript interface.
 */

/**
 * Lightweight provider reference for identification.
 */
export interface ProviderRef {
  id?: string | null;
  name: string | null;
  domain: string | null;
}
