import { TRPCError } from "@trpc/server";
import { getRun, start } from "workflow/api";
import z from "zod";
import { toRegistrableDomain } from "@/lib/domain-server";
import { createLogger } from "@/lib/logger/server";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import {
  type CertificatesWorkflowResult,
  certificatesWorkflow,
} from "@/workflows/certificates";
import {
  type FaviconWorkflowResult,
  faviconWorkflow,
} from "@/workflows/favicon";
import {
  type RegistrationWorkflowResult,
  registrationWorkflow,
} from "@/workflows/registration";
import {
  type ScreenshotWorkflowResult,
  screenshotWorkflow,
} from "@/workflows/screenshot";

const logger = createLogger({ source: "workflow-router" });

// Input schema for domain-based workflows
const DomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => {
    const registrable = toRegistrableDomain(domain);
    if (!registrable) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: '"domain" must be a valid and registrable',
      });
    }
    return { domain: registrable };
  });

// Workflow run ID input schema
const RunIdInputSchema = z.object({
  runId: z.string().min(1),
});

// Union of all workflow result types for status checking
type WorkflowResult =
  | ScreenshotWorkflowResult
  | RegistrationWorkflowResult
  | CertificatesWorkflowResult
  | FaviconWorkflowResult;

// Response schemas
const StartWorkflowResponseSchema = z.object({
  runId: z.string(),
  domain: z.string(),
});

const WorkflowStatusResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  result: z.unknown().optional(),
});

/**
 * Workflow router for durable backend operations.
 *
 * These procedures use the start + poll pattern:
 * 1. Call a start* mutation to kick off a workflow
 * 2. Poll getWorkflowStatus with the runId to check progress
 * 3. Once status is "completed", the result is available
 */
export const workflowRouter = createTRPCRouter({
  /**
   * Start a screenshot workflow for a domain.
   */
  startScreenshotWorkflow: publicProcedure
    .input(DomainInputSchema)
    .output(StartWorkflowResponseSchema)
    .mutation(async ({ input }) => {
      const run = await start(screenshotWorkflow, [{ domain: input.domain }]);

      logger.info(
        { domain: input.domain, runId: run.runId },
        "screenshot workflow started via tRPC",
      );

      return { runId: run.runId, domain: input.domain };
    }),

  /**
   * Start a registration workflow for a domain.
   */
  startRegistrationWorkflow: publicProcedure
    .input(DomainInputSchema)
    .output(StartWorkflowResponseSchema)
    .mutation(async ({ input }) => {
      const run = await start(registrationWorkflow, [{ domain: input.domain }]);

      logger.info(
        { domain: input.domain, runId: run.runId },
        "registration workflow started via tRPC",
      );

      return { runId: run.runId, domain: input.domain };
    }),

  /**
   * Start a certificates workflow for a domain.
   */
  startCertificatesWorkflow: publicProcedure
    .input(DomainInputSchema)
    .output(StartWorkflowResponseSchema)
    .mutation(async ({ input }) => {
      const run = await start(certificatesWorkflow, [{ domain: input.domain }]);

      logger.info(
        { domain: input.domain, runId: run.runId },
        "certificates workflow started via tRPC",
      );

      return { runId: run.runId, domain: input.domain };
    }),

  /**
   * Start a favicon workflow for a domain.
   */
  startFaviconWorkflow: publicProcedure
    .input(DomainInputSchema)
    .output(StartWorkflowResponseSchema)
    .mutation(async ({ input }) => {
      const run = await start(faviconWorkflow, [{ domain: input.domain }]);

      logger.info(
        { domain: input.domain, runId: run.runId },
        "favicon workflow started via tRPC",
      );

      return { runId: run.runId, domain: input.domain };
    }),

  /**
   * Get the status of a workflow run.
   * Use this to poll for completion after starting a workflow.
   */
  getWorkflowStatus: publicProcedure
    .input(RunIdInputSchema)
    .output(WorkflowStatusResponseSchema)
    .query(async ({ input }) => {
      try {
        const run = getRun<WorkflowResult>(input.runId);
        const status = await run.status;

        // Map workflow status to our response schema
        const mappedStatus = mapWorkflowStatus(status);

        if (mappedStatus === "completed") {
          const result = await run.returnValue;
          return {
            runId: input.runId,
            status: mappedStatus,
            result,
          };
        }

        return {
          runId: input.runId,
          status: mappedStatus,
        };
      } catch (err) {
        logger.error(
          { err, runId: input.runId },
          "failed to get workflow status",
        );
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow run not found",
        });
      }
    }),
});

/**
 * Map workflow SDK status to our response schema.
 */
function mapWorkflowStatus(
  status: string,
): "pending" | "running" | "completed" | "failed" | "cancelled" {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "running":
    case "sleeping":
    case "suspended":
      return "running";
    default:
      return "pending";
  }
}
