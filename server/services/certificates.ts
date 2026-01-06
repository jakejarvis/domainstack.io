import type tls from "node:tls";
import { after } from "next/server";
import { start } from "workflow/api";
import { createLogger } from "@/lib/logger/server";
import { scheduleRevalidation } from "@/lib/schedule";
import type { CertificatesResponse } from "@/lib/schemas";
import { certificatesWorkflow } from "@/workflows/certificates/workflow";

const logger = createLogger({ source: "certificates" });

export type ServiceOptions = {
  skipScheduling?: boolean;
};

/**
 * Fetch SSL/TLS certificates for a domain.
 *
 * This is a thin wrapper around the durable certificates workflow.
 * The workflow handles:
 * - Cache checking (Postgres)
 * - TLS handshake to fetch certificate chain
 * - CA provider detection
 * - Database persistence
 *
 * This service adds:
 * - Background revalidation scheduling (via `after()`)
 */
export async function getCertificates(
  domain: string,
  options: ServiceOptions = {},
): Promise<CertificatesResponse> {
  try {
    // Start the durable workflow
    const run = await start(certificatesWorkflow, [{ domain }]);

    logger.debug({ domain, runId: run.runId }, "certificates workflow started");

    // Wait for the workflow to complete and get the result
    const result = await run.returnValue;

    logger.debug(
      {
        domain,
        runId: run.runId,
        success: result.success,
        cached: result.cached,
        certCount: result.data.certificates.length,
      },
      "certificates workflow completed",
    );

    // Schedule background revalidation for successful non-cached results
    if (!options.skipScheduling && result.success && !result.cached) {
      void after(() =>
        scheduleRevalidation(
          domain,
          "certificates",
          // Use a reasonable default - certificates typically expire in weeks/months
          Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          null,
        ),
      );
    }

    return result.data;
  } catch (err) {
    logger.error({ err, domain }, "certificates workflow failed");
    throw err;
  }
}

/**
 * Convert a certificate subject object to a displayable name string.
 * Exported for use in other modules.
 */
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

/**
 * Parse Subject Alternative Names from a certificate.
 * Exported for use in other modules.
 */
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
