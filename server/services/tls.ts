import tls from "node:tls";
import { captureServer } from "@/lib/analytics/server";
import { cacheGet, cacheSet, ns } from "@/lib/redis";

export type Certificate = {
  issuer: string;
  subject: string;
  altNames: string[];
  validFrom: string;
  validTo: string;
};

export async function getCertificates(domain: string): Promise<Certificate[]> {
  const lower = domain.toLowerCase();
  const key = ns("tls", lower);

  // Cache check
  const cached = await cacheGet<Certificate[]>(key);
  if (cached) return cached;

  // Client gating avoids calling this without A/AAAA; server does not pre-check DNS here.

  const startedAt = Date.now();
  let outcome: "ok" | "timeout" | "error" = "ok";
  try {
    const chain = await new Promise<tls.DetailedPeerCertificate[]>(
      (resolve, reject) => {
        const socket = tls.connect(
          {
            host: domain,
            port: 443,
            servername: domain,
            rejectUnauthorized: false,
          },
          () => {
            const peer = socket.getPeerCertificate(
              true,
            ) as tls.DetailedPeerCertificate;
            const chain: tls.DetailedPeerCertificate[] = [];
            let current: tls.DetailedPeerCertificate | null = peer;
            while (current) {
              chain.push(current);
              const next = (
                current as unknown as { issuerCertificate?: unknown }
              ).issuerCertificate as tls.DetailedPeerCertificate | undefined;
              current = next && next !== current ? next : null;
            }
            socket.end();
            resolve(chain);
          },
        );
        socket.setTimeout(6000, () => {
          outcome = "timeout";
          socket.destroy(new Error("TLS timeout"));
        });
        socket.on("error", (err) => {
          outcome = "error";
          reject(err);
        });
      },
    );

    const out: Certificate[] = chain.map((c) => ({
      issuer: toName(c.issuer),
      subject: toName(c.subject),
      altNames: parseAltNames(
        (c as Partial<{ subjectaltname: string }>).subjectaltname,
      ),
      validFrom: new Date(c.valid_from).toISOString(),
      validTo: new Date(c.valid_to).toISOString(),
    }));

    await captureServer("tls_probe", {
      domain: lower,
      chain_length: out.length,
      duration_ms: Date.now() - startedAt,
      outcome,
    });

    // Cache success for longer; empty chains are still cached briefly
    await cacheSet(key, out, out.length > 0 ? 12 * 60 * 60 : 10 * 60);
    return out;
  } catch (err) {
    await captureServer("tls_probe", {
      domain: lower,
      chain_length: 0,
      duration_ms: Date.now() - startedAt,
      outcome,
      error: String(err),
    });
    // Do not treat as fatal; return empty and avoid long-lived negative cache
    return [];
  }
}

export function toName(subject: tls.PeerCertificate["subject"] | undefined) {
  if (!subject) return "";
  const maybeRecord = subject as unknown as Record<string, unknown>;
  const cn =
    typeof maybeRecord?.CN === "string"
      ? (maybeRecord.CN as string)
      : undefined;
  const o =
    typeof maybeRecord?.O === "string" ? (maybeRecord.O as string) : undefined;
  return cn ? cn : o ? o : JSON.stringify(subject);
}

export function parseAltNames(subjectAltName: string | undefined): string[] {
  if (typeof subjectAltName !== "string" || subjectAltName.length === 0) {
    return [];
  }
  return subjectAltName
    .split(",")
    .map((segment) => segment.trim())
    .map((segment) => {
      const idx = segment.indexOf(":");
      if (idx === -1) return ["", segment] as const;
      const kind = segment.slice(0, idx).trim().toUpperCase();
      const value = segment.slice(idx + 1).trim();
      return [kind, value] as const;
    })
    .filter(
      ([kind, value]) => !!value && (kind === "DNS" || kind === "IP ADDRESS"),
    )
    .map(([_, value]) => value);
}
