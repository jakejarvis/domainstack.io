/**
 * TLS certificate fetching via TLS handshake.
 *
 * Uses Node.js TLS module to connect and extract certificate chain.
 * Uses dynamic import for node:tls to support workflow step contexts.
 *
 * DNS is resolved first through `@domainstack/safe-fetch` so `tls.connect`
 * only dials validated public addresses, while SNI stays the original domain.
 */

import type { TLSSocket } from "node:tls";

import {
  createPinnedLookup,
  isExpectedDnsError,
  resolvePublicHost,
  SafeFetchError,
} from "@domainstack/safe-fetch";

import type { TlsFetchOptions, TlsFetchResult } from "./types";
import {
  InvalidCertificateDateError,
  isEmptyPeerCertificate,
  isExpectedTlsError,
  readTlsAuthorization,
  walkCertificateChain,
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

  let addresses;
  try {
    addresses = await resolvePublicHost(domain, { timeoutMs });
  } catch (err) {
    return mapResolutionError(err);
  }

  try {
    const observation = await new Promise<Extract<TlsFetchResult, { success: true }>>(
      (resolve, reject) => {
        let isDestroyed = false;

        const socket = tls.connect(
          {
            host: domain,
            port,
            servername: domain,
            rejectUnauthorized: false,
            lookup: createPinnedLookup(addresses),
          },
          () => {
            socket.setTimeout(0);

            try {
              resolve(readHandshake(socket));
            } catch (err) {
              reject(err);
            } finally {
              if (!isDestroyed) {
                isDestroyed = true;
                socket.destroy();
              }
            }
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
      },
    );

    return observation;
  } catch (err) {
    if (err instanceof InvalidCertificateDateError) {
      return { success: false, error: "tls_error" };
    }

    // Check for timeout first (before TLS error check, since "TLS timeout" contains "tls")
    if (err instanceof Error && err.message === "TLS timeout") {
      return { success: false, error: "timeout" };
    }

    if (isExpectedDnsError(err)) {
      return { success: false, error: "dns_error" };
    }

    if (isExpectedTlsError(err)) {
      return { success: false, error: "tls_error" };
    }

    return { success: false, error: "fetch_error" };
  }
}

function readHandshake(socket: TLSSocket): Extract<TlsFetchResult, { success: true }> {
  const peer = socket.getPeerCertificate(true);

  if (isEmptyPeerCertificate(peer)) {
    throw Object.assign(new Error("No certificate"), { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" });
  }

  const { chain, chainComplete } = walkCertificateChain(peer);
  if (chain.length === 0) {
    throw Object.assign(new Error("No certificate"), { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" });
  }

  const { valid, validationError } = readTlsAuthorization(socket);
  const cipherInfo = socket.getCipher();
  const publicKeyBits = typeof peer.bits === "number" ? peer.bits : null;

  return {
    success: true,
    chain,
    valid,
    validationError,
    protocol: socket.getProtocol() ?? null,
    cipher: cipherInfo?.name ?? null,
    publicKeyBits,
    chainComplete,
  };
}

function mapResolutionError(err: unknown): TlsFetchResult {
  if (err instanceof SafeFetchError) {
    if (err.code === "host_blocked" || err.code === "private_ip") {
      return { success: false, error: "fetch_error" };
    }
    if (err.code === "timeout" || err.message.toLowerCase().includes("timed out")) {
      return { success: false, error: "timeout" };
    }
    if (err.code === "dns_error") {
      return { success: false, error: "dns_error" };
    }
  }

  if (isExpectedDnsError(err)) {
    return { success: false, error: "dns_error" };
  }

  return { success: false, error: "fetch_error" };
}
