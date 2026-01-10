import { FatalError, RetryableError } from "workflow";
import type { DnsRecordsResponse } from "@/lib/types/domain/dns";

export interface DnsWorkflowInput {
  domain: string;
}

export type DnsWorkflowResult =
  | {
      success: true;
      data: DnsRecordsResponse;
    }
  | {
      success: false;
      error: string;
      data: DnsRecordsResponse | null;
    };

/**
 * Durable DNS workflow that breaks down DNS resolution into
 * independently retryable steps:
 * 1. Fetch from DoH providers with fallback
 * 2. Persist to database (creates domain record if needed)
 */
export async function dnsWorkflow(
  input: DnsWorkflowInput,
): Promise<DnsWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch from DoH providers
  const fetchResult = await fetchDnsRecordsStep(domain);

  // Step 2: Persist to database
  await persistDnsRecordsStep(domain, fetchResult);

  return {
    success: true,
    data: {
      records: fetchResult.records,
      resolver: fetchResult.resolver,
    },
  };
}

// Internal type for step-to-step transfer
interface FetchStepResult {
  records: DnsRecordsResponse["records"];
  resolver: string;
  recordsWithExpiry: Array<{
    type: string;
    name: string;
    value: string;
    ttl?: number;
    priority?: number;
    isCloudflare?: boolean;
    expiresAt: string;
  }>;
}

/**
 * Step: Fetch DNS records from DoH providers with fallback
 */
async function fetchDnsRecordsStep(domain: string): Promise<FetchStepResult> {
  "use step";

  const { fetchDnsRecords } = await import("@/lib/domain/dns-lookup");

  const result = await fetchDnsRecords(domain);

  if (!result) {
    throw new RetryableError("All DoH providers failed", { retryAfter: "5s" });
  }

  return result;
}

// Allow more retries for DNS since DoH providers can be flaky
fetchDnsRecordsStep.maxRetries = 5;

/**
 * Step: Persist DNS records to database
 */
async function persistDnsRecordsStep(
  domain: string,
  fetchResult: FetchStepResult,
): Promise<void> {
  "use step";

  const { persistDnsRecords } = await import("@/lib/domain/dns-lookup");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "dns-workflow" });

  try {
    await persistDnsRecords(
      domain,
      fetchResult.resolver,
      fetchResult.recordsWithExpiry as Parameters<typeof persistDnsRecords>[2],
    );
  } catch (err) {
    logger.error({ err, domain }, "failed to persist dns records");
    throw new FatalError("Failed to persist DNS records");
  }
}
