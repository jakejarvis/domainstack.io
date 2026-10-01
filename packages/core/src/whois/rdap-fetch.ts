import { safeFetch } from "@domainstack/safe-fetch";
import type { FetchLike } from "rdapper";

/** RDAP JSON is small; 2 MB covers the largest real responses with room to spare. */
const RDAP_MAX_BYTES = 2 * 1024 * 1024;

/** Statuses the `Response` constructor refuses to build with a body. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

function toHeaderRecord(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) return undefined;
  return Object.fromEntries(new Headers(headers).entries());
}

function combineSignals(...signals: Array<AbortSignal | null | undefined>): AbortSignal | undefined {
  const present = signals.filter((s): s is AbortSignal => Boolean(s));
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return AbortSignal.any(present);
}

/**
 * rdapper `customFetch` backed by safeFetch: private/reserved addresses are refused on
 * every hop (including followed RDAP links and redirects), bodies are capped, and the
 * socket is pinned to the validated address. rdapper's own abort signal still applies.
 */
export function createRdapFetch(options: { userAgent?: string; timeoutMs: number }): FetchLike {
  return async (input, init) => {
    const result = await safeFetch({
      url: input.toString(),
      userAgent: options.userAgent,
      headers: toHeaderRecord(init?.headers),
      timeoutMs: options.timeoutMs,
      maxBytes: RDAP_MAX_BYTES,
      maxRedirects: 3,
      // Some registrar RDAP endpoints are plain http; address checks still apply.
      allowHttp: true,
      // Must forward `fetchInit` (it carries the pinned `dispatcher`).
      fetch: (url, fetchInit) =>
        fetch(url, {
          ...fetchInit,
          signal: combineSignals(fetchInit?.signal, init?.signal),
        }),
    });

    const hasBody = !NULL_BODY_STATUSES.has(result.status);
    return new Response(hasBody ? new Uint8Array(result.buffer) : null, {
      status: result.status,
      headers: result.headers,
    });
  };
}
