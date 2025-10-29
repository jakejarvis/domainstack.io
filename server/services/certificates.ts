import tls from "node:tls";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { replaceCertificates } from "@/lib/db/repos/certificates";
import { findDomainByName } from "@/lib/db/repos/domains";
import { resolveOrCreateProviderId } from "@/lib/db/repos/providers";
import { certificates as certTable } from "@/lib/db/schema";
import { ttlForCertificates } from "@/lib/db/ttl";
import { toRegistrableDomain } from "@/lib/domain-server";
import { detectCertificateAuthority } from "@/lib/providers/detection";
import { scheduleSectionIfEarlier } from "@/lib/schedule";
import type { Certificate } from "@/lib/schemas";

export async function getCertificates(domain: string): Promise<Certificate[]> {
  console.debug(`[certificates] start ${domain}`);

  // Only support registrable domains (no subdomains, IPs, or invalid TLDs)
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new Error(`Cannot extract registrable domain from ${domain}`);
  }

  // Fast path: Check Postgres for cached certificate data
  const existingDomain = await findDomainByName(registrable);
  const existing = existingDomain
    ? await db
        .select({
          issuer: certTable.issuer,
          subject: certTable.subject,
          altNames: certTable.altNames,
          validFrom: certTable.validFrom,
          validTo: certTable.validTo,
          expiresAt: certTable.expiresAt,
        })
        .from(certTable)
        .where(eq(certTable.domainId, existingDomain.id))
    : ([] as Array<{
        issuer: string;
        subject: string;
        altNames: unknown;
        validFrom: Date;
        validTo: Date;
        expiresAt: Date | null;
      }>);
  if (existing.length > 0) {
    const nowMs = Date.now();
    const fresh = existing.every(
      (c) => (c.expiresAt?.getTime?.() ?? 0) > nowMs,
    );
    if (fresh) {
      const out: Certificate[] = existing.map((c) => ({
        issuer: c.issuer,
        subject: c.subject,
        altNames: (c.altNames as unknown as string[]) ?? [],
        validFrom: new Date(c.validFrom).toISOString(),
        validTo: new Date(c.validTo).toISOString(),
        caProvider: detectCertificateAuthority(c.issuer),
      }));
      return out;
    }
  }

  // Client gating avoids calling this without A/AAAA; server does not pre-check DNS here.
  // Probe TLS connection to get certificate chain

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
          socket.destroy(new Error("TLS timeout"));
        });
        socket.on("error", (err) => {
          reject(err);
        });
      },
    );

    const out: Certificate[] = chain.map((c) => {
      const issuerName = toName(c.issuer);
      return {
        issuer: issuerName,
        subject: toName(c.subject),
        altNames: parseAltNames(
          (c as Partial<{ subjectaltname: string }>).subjectaltname,
        ),
        validFrom: new Date(c.valid_from).toISOString(),
        validTo: new Date(c.valid_to).toISOString(),
        caProvider: detectCertificateAuthority(issuerName),
      };
    });

    const now = new Date();
    const earliestValidTo =
      out.length > 0
        ? new Date(Math.min(...out.map((c) => new Date(c.validTo).getTime())))
        : new Date(Date.now() + 3600_000);

    // Persist to Postgres only if domain exists (i.e., is registered)
    if (existingDomain) {
      const chainWithIds = await Promise.all(
        out.map(async (c) => {
          const caProviderId = await resolveOrCreateProviderId({
            category: "ca",
            domain: c.caProvider.domain,
            name: c.caProvider.name,
          });
          return {
            issuer: c.issuer,
            subject: c.subject,
            altNames: c.altNames as unknown as string[],
            validFrom: new Date(c.validFrom),
            validTo: new Date(c.validTo),
            caProviderId,
          };
        }),
      );

      const nextDue = ttlForCertificates(now, earliestValidTo);
      await replaceCertificates({
        domainId: existingDomain.id,
        chain: chainWithIds,
        fetchedAt: now,
        expiresAt: nextDue,
      });
      try {
        const dueAtMs = nextDue.getTime();
        await scheduleSectionIfEarlier(
          "certificates",
          registrable ?? domain,
          dueAtMs,
        );
      } catch (err) {
        console.warn(
          `[certificates] schedule failed for ${registrable ?? domain}`,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }

    console.info(
      `[certificates] ok ${registrable ?? domain} chainLength=${out.length}`,
    );
    return out;
  } catch (err) {
    console.warn(
      `[certificates] error ${registrable ?? domain}`,
      err instanceof Error ? err : new Error(String(err)),
    );
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
