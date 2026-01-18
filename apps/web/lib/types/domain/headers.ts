/**
 * HTTP Headers types - Plain TypeScript interfaces.
 */

/**
 * A single HTTP header.
 */
export interface Header {
  name: string;
  value: string;
}

/**
 * Response from HTTP header probe.
 */
export interface HeadersResponse {
  headers: Header[];
  status: number;
  statusMessage?: string;
}
