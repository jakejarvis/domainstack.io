import type { RegistrationSource } from "@domainstack/types";

/** Hostname of a URL or bare host, or undefined when it doesn't parse. */
function hostnameOf(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname || undefined;
  } catch {
    return;
  }
}

/**
 * Where registration data came from, for "Verified by …" labels: the last RDAP
 * server in the referral chain (linked), else the WHOIS server, plus a link
 * explaining the protocol.
 */
export function describeRegistrationSource({
  whoisServer,
  rdapServers,
  source,
}: {
  whoisServer?: string | null;
  rdapServers?: string[] | null;
  source?: RegistrationSource | null;
}) {
  const serverUrl = rdapServers && rdapServers.length > 0 ? rdapServers.at(-1) : undefined;
  const isRdap = source === "rdap";
  return {
    serverUrl,
    serverName: serverUrl ? (hostnameOf(serverUrl) ?? "RDAP") : (whoisServer ?? "WHOIS"),
    learnUrl: isRdap ? "https://about.rdap.org/" : "https://en.wikipedia.org/wiki/WHOIS",
    sourceLabel: isRdap ? "RDAP" : "WHOIS",
  };
}
