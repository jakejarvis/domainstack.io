import { after } from "next/server";
import { start } from "workflow/api";
import { createLogger } from "@/lib/logger/server";
import { scheduleRevalidation } from "@/lib/schedule";
import type { RegistrationResponse } from "@/lib/schemas";
import { registrationWorkflow } from "@/workflows/registration/workflow";

const logger = createLogger({ source: "registration" });

export type ServiceOptions = {
  skipScheduling?: boolean;
};

/**
 * Fetch domain registration using rdapper and cache the normalized DomainRecord.
 *
 * This is a thin wrapper around the durable registration workflow.
 * The workflow handles:
 * - Cache checking (Postgres)
 * - RDAP/WHOIS lookup via rdapper
 * - Registrar normalization and provider detection
 * - Database persistence
 *
 * This service adds:
 * - Background revalidation scheduling (via `after()`)
 */
export async function getRegistration(
  domain: string,
  options: ServiceOptions = {},
): Promise<RegistrationResponse> {
  try {
    // Start the durable workflow
    const run = await start(registrationWorkflow, [{ domain }]);

    logger.debug({ domain, runId: run.runId }, "registration workflow started");

    // Wait for the workflow to complete and get the result
    const result = await run.returnValue;

    logger.debug(
      {
        domain,
        runId: run.runId,
        success: result.success,
        cached: result.cached,
      },
      "registration workflow completed",
    );

    // Schedule background revalidation for successful non-cached results
    // (the workflow persisted fresh data that will need revalidation later)
    if (!options.skipScheduling && result.success && !result.cached) {
      // Schedule revalidation based on default TTL
      // The actual scheduling is handled by the section-revalidate Inngest function
      void after(() =>
        scheduleRevalidation(
          domain,
          "registration",
          // Use a reasonable default - fresh data typically expires in 24h
          Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          null, // lastAccessedAt not available here
        ),
      );
    }

    if (!result.success) {
      // Workflow completed but lookup failed (unsupported TLD, timeout, etc.)
      // Return the error response data if available
      if (result.data) {
        return result.data;
      }

      // Fallback error response
      throw new Error(
        `Registration lookup failed for ${domain}: ${result.error}`,
      );
    }

    return result.data;
  } catch (err) {
    logger.error({ err, domain }, "registration workflow failed");
    throw err;
  }
}
