import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";

import * as ipaddr from "ipaddr.js";

import type { ResolvedIp } from "./dns";
import { SafeFetchError } from "./errors";
import { isPrivateIp } from "./ip";
import type { SafeFetchLogger } from "./types";

const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

export interface ResolvePublicHostOptions {
  /** Timeout for the DNS lookup in ms (default: 8000) */
  timeoutMs?: number;
  logger?: SafeFetchLogger;
}

/**
 * True when the hostname is blocked from outbound connections.
 */
export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return BLOCKED_HOSTNAMES.has(normalized) || BLOCKED_SUFFIXES.some((s) => normalized.endsWith(s));
}

function ipFamily(address: string): 4 | 6 {
  try {
    return ipaddr.parse(address).kind() === "ipv6" ? 6 : 4;
  } catch {
    return 4;
  }
}

async function lookupWithTimeout(
  hostname: string,
  timeoutMs: number,
): Promise<Array<{ address: string; family: 4 | 6 }>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      lookup(hostname, {
        all: true,
        verbatim: true,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`DNS lookup timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);

    const records = Array.isArray(result) ? result : [result];
    return records.map((record) => ({
      address: record.address,
      family: record.family === 6 ? 6 : 4,
    }));
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Resolve a hostname (or literal IP) to public unicast addresses.
 *
 * Rejects blocked names, loopback/link-local/private/reserved addresses, and
 * mixed public/private answers. Callers that must not leak internal network
 * details should map `host_blocked` and `private_ip` to a generic failure.
 */
export async function resolvePublicHost(
  hostname: string,
  options: ResolvePublicHostOptions = {},
): Promise<ResolvedIp[]> {
  const { timeoutMs = 8000, logger } = options;
  const normalized = hostname.trim().toLowerCase();

  if (!normalized) {
    throw new SafeFetchError("invalid_url", "URL missing hostname");
  }

  if (isBlockedHostname(normalized)) {
    throw new SafeFetchError("host_blocked", `Host ${normalized} is blocked`);
  }

  if (ipaddr.isValid(normalized)) {
    if (isPrivateIp(normalized)) {
      throw new SafeFetchError("private_ip", `IP ${normalized} is not reachable`);
    }
    return [{ address: normalized, family: ipFamily(normalized) }];
  }

  let records: Array<{ address: string; family: 4 | 6 }>;
  try {
    records = await lookupWithTimeout(normalized, timeoutMs);
  } catch (err) {
    logger?.warn({ hostname: normalized, err }, "DNS lookup failed");
    const message = err instanceof Error ? err.message : "DNS lookup failed";
    throw new SafeFetchError("dns_error", message);
  }

  if (records.length === 0) {
    throw new SafeFetchError("dns_error", "DNS lookup returned no records");
  }

  if (records.some((record) => isPrivateIp(record.address))) {
    throw new SafeFetchError(
      "private_ip",
      `DNS for ${normalized} resolved to a non-public address`,
    );
  }

  return records;
}

/**
 * Pin `tls.connect` / `net.connect` to a previously validated address set
 * so a later DNS answer cannot redirect the socket to a private target.
 */
export function createPinnedLookup(addresses: ResolvedIp[]): LookupFunction {
  const mapped: LookupAddress[] = addresses.map((address) => ({
    address: address.address,
    family: address.family,
  }));

  return (hostname, options, callback) => {
    const family = options.family;
    const candidates =
      family === 4 || family === 6 ? mapped.filter((address) => address.family === family) : mapped;
    const all = Boolean(options.all);

    if (candidates.length === 0) {
      const err = Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
        code: "ENOTFOUND",
      });
      if (all) {
        const empty: LookupAddress[] = [];
        callback(err, empty, 4);
      } else {
        callback(err, "", 4);
      }
      return;
    }

    if (all) {
      callback(null, candidates);
      return;
    }

    const first = candidates[0];
    callback(null, first.address, first.family);
  };
}
