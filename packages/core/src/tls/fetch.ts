/**
 * TLS certificate fetching via TLS handshake.
 *
 * Uses Node.js TLS module to connect and extract certificate chain.
 * Uses dynamic import for node:tls to support workflow step contexts.
 */

import type { DetailedPeerCertificate } from "node:tls";
import type { RawCertificate, TlsFetchOptions, TlsFetchResult } from "./types";
import {
  isExpectedDnsError,
  isExpectedTlsError,
  parseAltNames,
  toName,
} from "./utils";

/**
 * Fetch TLS certificate chain from a domain via TLS handshake.
 *
 * Uses dynamic import for node:tls to support both regular Node.js
 * and Vercel Workflow step contexts.
 *
 * @param domain - The domain to connect to
 * @param options - Optional configuration
 * @returns TlsFetchResult with certificate chain or error
 */
export async function fetchCertificateChain(
  domain: string,
  options: TlsFetchOptions = {},
): Promise<TlsFetchResult> {
  // Dynamic import for workflow step compatibility
  const tls = await import("node:tls");

  const timeoutMs = options.timeoutMs ?? 6000;
  const port = options.port ?? 443;

  try {
    const chain = await new Promise<RawCertificate[]>((resolve, reject) => {
      let isDestroyed = false;

      const socket = tls.connect(
        {
          host: domain,
          port,
          servername: domain,
          rejectUnauthorized: false,
        },
        () => {
          socket.setTimeout(0);
          const peer = socket.getPeerCertificate(
            true,
          ) as DetailedPeerCertificate;

          const chain: RawCertificate[] = [];
          let current: DetailedPeerCertificate | null = peer;

          while (current) {
            chain.push({
              issuer: toName(current.issuer),
              subject: toName(current.subject),
              altNames: parseAltNames(
                (current as Partial<{ subjectaltname: string }>).subjectaltname,
              ),
              validFrom: new Date(current.valid_from).toISOString(),
              validTo: new Date(current.valid_to).toISOString(),
            });

            const next = (current as unknown as { issuerCertificate?: unknown })
              .issuerCertificate as DetailedPeerCertificate | undefined;
            current = next && next !== current ? next : null;
          }

          socket.end();
          resolve(chain);
        },
      );

      socket.setTimeout(timeoutMs, () => {
        if (!isDestroyed) {
          isDestroyed = true;
          socket.destroy(new Error("TLS timeout"));
        }
      });

      socket.on("error", (err) => {
        if (!isDestroyed) {
          isDestroyed = true;
          socket.destroy();
        }
        reject(err);
      });
    });

    return { success: true, chain };
  } catch (err) {
    if (isExpectedDnsError(err)) {
      return { success: false, error: "dns_error" };
    }

    if (isExpectedTlsError(err)) {
      return { success: false, error: "tls_error" };
    }

    // Check for timeout
    if (err instanceof Error && err.message === "TLS timeout") {
      return { success: false, error: "timeout" };
    }

    return { success: false, error: "fetch_error" };
  }
}
