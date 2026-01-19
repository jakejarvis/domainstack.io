import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import { analytics } from "@/lib/analytics/server";
import { getDomainById } from "@/lib/db/repos/domains";
import { getScreenshotByDomainId } from "@/lib/db/repos/screenshots";
import { createLogger } from "@/lib/logger/server";
import { checkRateLimit } from "@/lib/ratelimit/api";
import {
  getDeduplicationKey,
  startDeduplicated,
} from "@/lib/workflow/deduplication";
import {
  type ScreenshotWorkflowResult,
  screenshotWorkflow,
} from "@/workflows/screenshot";

const logger = createLogger({ source: "api/screenshot" });

/**
 * Response types for the screenshot API
 */
type ScreenshotStartResponse =
  | {
      status: "completed";
      cached: true;
      data: { url: string | null; blocked: boolean };
    }
  | { status: "running"; runId: string };

type ScreenshotStatusResponse =
  | { status: "running" }
  | {
      status: "completed";
      cached: false;
      success: true;
      data: { url: string | null; blocked?: boolean };
    }
  | {
      status: "completed";
      cached: false;
      success: false;
      error: string;
      data: { url: null };
    }
  | { status: "failed"; error: string };

/**
 * POST /api/screenshot
 *
 * Start a screenshot workflow for a domain.
 * Accepts { domainId: string } in the request body.
 * Returns cached result immediately if available, otherwise starts workflow.
 *
 * Rate limited to 10 requests/minute (expensive operation).
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ScreenshotStartResponse | { error: string }>> {
  // Rate limit: 10 requests/minute for expensive screenshot workflow
  const rateLimit = await checkRateLimit(request, {
    name: "api:screenshot:post",
    requests: 10,
    window: "1 m",
  });
  if (!rateLimit.success) {
    return new NextResponse(rateLimit.error.body, {
      status: 429,
      headers: rateLimit.error.headers,
    });
  }

  try {
    const body = await request.json();
    const { domainId } = body as { domainId?: string };

    if (!domainId || typeof domainId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid domainId" },
        { status: 400 },
      );
    }

    // Look up domain by ID (security check - domain must exist)
    const domain = await getDomainById(domainId);

    if (!domain) {
      logger.warn({ domainId }, "screenshot requested for unknown domain");
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    // Check cache first
    const cachedScreenshot = await getScreenshotByDomainId(domainId);

    if (cachedScreenshot) {
      // Only treat as cache hit if we have a definitive result:
      // - url is present (string), OR
      // - url is null but marked as permanently not found
      const isDefinitiveResult =
        cachedScreenshot.url !== null || cachedScreenshot.notFound === true;

      if (isDefinitiveResult) {
        // Check current block status dynamically
        let blocked = false;
        if (cachedScreenshot.url) {
          try {
            // We already have the domain name, no need to parse URL
            const domainName = domain.name;

            // Import and check block status
            const { isDomainBlocked } = await import(
              "@/lib/db/repos/blocked-domains"
            );
            blocked = await isDomainBlocked(domainName);
          } catch (err) {
            // Log error but fall back to unblocked to avoid breaking screenshots
            // for transient database issues. Blocked domains are a soft protection.
            logger.warn(
              { err, domain: domain.name },
              "failed to check block status, defaulting to unblocked",
            );
            blocked = false;
          }
        }

        analytics.track("screenshot_api_cache_hit", {
          domain: domain.name,
        });

        return NextResponse.json(
          {
            status: "completed",
            cached: true,
            data: { url: cachedScreenshot.url, blocked },
          },
          { headers: rateLimit.headers },
        );
      }
    }

    // Cache miss - start workflow with deduplication
    // Uses Redis to deduplicate across instances, returning existing runId if already running
    const key = getDeduplicationKey("screenshot", domain.name);
    const { runId, started } = await startDeduplicated(
      key,
      () => start(screenshotWorkflow, [{ domain: domain.name }]),
      { ttlSeconds: 5 * 60 }, // 5 minute TTL
    );

    if (started) {
      logger.debug(
        { domainId, domain: domain.name, runId },
        "screenshot workflow started",
      );

      analytics.track("screenshot_api_workflow_started", {
        domain: domain.name,
        runId,
      });
    } else {
      logger.debug(
        { domainId, domain: domain.name, runId },
        "attached to existing screenshot workflow",
      );

      analytics.track("screenshot_api_workflow_attached", {
        domain: domain.name,
        runId,
      });
    }

    return NextResponse.json(
      {
        status: "running",
        runId,
      },
      { headers: rateLimit.headers },
    );
  } catch (err) {
    logger.error({ err }, "failed to start screenshot workflow");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/screenshot?runId=xxx
 *
 * Poll for screenshot workflow status.
 * Returns the current status and result when completed.
 *
 * Rate limited to 120 requests/minute (polling endpoint).
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ScreenshotStatusResponse | { error: string }>> {
  // Rate limit: 120 requests/minute for polling (allows ~2 req/sec)
  const rateLimit = await checkRateLimit(request, {
    name: "api:screenshot:get",
    requests: 120,
    window: "1 m",
  });
  if (!rateLimit.success) {
    return new NextResponse(rateLimit.error.body, {
      status: 429,
      headers: rateLimit.error.headers,
    });
  }

  const runId = request.nextUrl.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  try {
    const run = getRun(runId);
    const status = await run.status;

    if (status === "completed") {
      const result = (await run.returnValue) as ScreenshotWorkflowResult;

      analytics.track("screenshot_api_workflow_completed", {
        runId,
        success: result.success,
      });

      return NextResponse.json(
        {
          status: "completed",
          cached: false,
          success: result.success,
          data: result.data,
          ...(result.success === false && { error: result.error }),
        } as ScreenshotStatusResponse,
        { headers: rateLimit.headers },
      );
    }

    if (status === "failed") {
      analytics.track("screenshot_api_workflow_failed", { runId });

      return NextResponse.json(
        {
          status: "failed",
          error: "workflow_failed",
        },
        { headers: rateLimit.headers },
      );
    }

    // Still running
    return NextResponse.json(
      { status: "running" },
      { headers: rateLimit.headers },
    );
  } catch (err) {
    logger.warn({ err, runId }, "failed to get workflow run status");
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
}
