import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHookByToken, getRun, start } from "workflow/api";
import { HookNotFoundError, WorkflowRunNotFoundError } from "workflow/errors";

import { checkRateLimit } from "@/lib/ratelimit/api";
import {
  getScreenshotWorkflowToken,
  type ScreenshotWorkflowResult,
  screenshotWorkflow,
} from "@/workflows/screenshot";
import { isDomainBlocked } from "@domainstack/db/queries/blocked-domains";
import { getDomainById } from "@domainstack/db/queries/domains";
import { getScreenshotByDomainId } from "@domainstack/db/queries/screenshots";
import { createLogger } from "@domainstack/logger";
import type { ScreenshotData } from "@domainstack/types";

const logger = createLogger({ source: "api/screenshot" });

type ScreenshotStartResponse =
  | { status: "completed"; cached: true; data: ScreenshotData }
  | { status: "running"; runId: string };

type ScreenshotStatusResponse =
  | { status: "running" }
  | { status: "completed"; cached: false; success: true; data: ScreenshotData }
  | { status: "completed"; cached: false; success: false; error: string; data: { url: null } }
  | { status: "failed"; error: string };

const NO_STORE_HEADERS = {
  "Cache-Control": "no-cache, no-store",
} as const;

function withNoStore(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return result;
}

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
  const rateLimitPromise = checkRateLimit(request, {
    name: "api:screenshot:post",
    requests: 10,
    window: "1 m",
  });
  const bodyPromise = request.json();

  const rateLimit = await rateLimitPromise;
  if (!rateLimit.success) {
    void bodyPromise.catch(() => undefined);
    return new NextResponse(rateLimit.error.body, {
      status: 429,
      headers: rateLimit.error.headers,
    });
  }

  try {
    const body = await bodyPromise;
    const { domainId } = body as { domainId?: string };

    if (!domainId || typeof domainId !== "string") {
      return NextResponse.json({ error: "Missing or invalid domainId" }, { status: 400 });
    }

    const [domain, cachedScreenshot] = await Promise.all([
      getDomainById(domainId),
      getScreenshotByDomainId(domainId),
    ]);

    if (!domain) {
      logger.debug({ domainId }, "screenshot requested for unknown domain");
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    if (cachedScreenshot) {
      // Only treat as cache hit if we have a definitive result:
      // - url is present (string), OR
      // - url is null but marked as permanently not found
      const isDefinitiveResult = cachedScreenshot.url !== null || cachedScreenshot.notFound;

      if (isDefinitiveResult) {
        // Check current block status dynamically
        let blocked = false;
        if (cachedScreenshot.url) {
          try {
            // We already have the domain name, no need to parse URL
            const domainName = domain.name;

            // Check block status
            blocked = await isDomainBlocked(domainName);
          } catch (err) {
            // Log error but fall back to unblocked to avoid breaking screenshots
            // for transient database issues. Blocked domains are a soft protection.
            logger.error(
              { err, domain: domain.name },
              "failed to check block status, defaulting to unblocked",
            );
            blocked = false;
          }
        }

        return NextResponse.json(
          {
            status: "completed",
            cached: true,
            data: { url: cachedScreenshot.url, blocked },
          },
          { headers: withNoStore(rateLimit.headers) },
        );
      }
    }

    // Cache miss - reuse an active workflow when its ownership hook has
    // already been registered. The workflow also checks for hook conflicts
    // to close the race between this advisory lookup and start().
    const token = getScreenshotWorkflowToken(domainId);
    try {
      const activeHook = await getHookByToken(token);
      logger.debug(
        { domainId, domain: domain.name, runId: activeHook.runId },
        "reusing active screenshot workflow",
      );
      return NextResponse.json(
        { status: "running", runId: activeHook.runId },
        { headers: withNoStore(rateLimit.headers) },
      );
    } catch (err) {
      if (!HookNotFoundError.is(err)) {
        logger.warn(
          { err, domainId, domain: domain.name },
          "failed to look up screenshot workflow",
        );
      }
    }

    const run = await start(screenshotWorkflow, [{ domain: domain.name, domainId }]);

    logger.debug(
      { domainId, domain: domain.name, runId: run.runId },
      "screenshot workflow started",
    );

    return NextResponse.json(
      {
        status: "running",
        runId: run.runId,
      },
      { headers: withNoStore(rateLimit.headers) },
    );
  } catch (err) {
    logger.error({ err }, "failed to start screenshot workflow");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

      return NextResponse.json(
        {
          status: "completed",
          cached: false,
          success: result.success,
          data: result.data,
          ...(!result.success && { error: result.error }),
        } as ScreenshotStatusResponse,
        { headers: withNoStore(rateLimit.headers) },
      );
    }

    if (status === "failed" || status === "cancelled") {
      return NextResponse.json(
        {
          status: "failed",
          error: status === "cancelled" ? "workflow_cancelled" : "workflow_failed",
        },
        { headers: withNoStore(rateLimit.headers) },
      );
    }

    // Pending and running are both non-terminal.
    return NextResponse.json({ status: "running" }, { headers: withNoStore(rateLimit.headers) });
  } catch (err) {
    if (WorkflowRunNotFoundError.is(err)) {
      logger.debug({ err, runId }, "workflow run not visible yet");
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    logger.warn({ err, runId }, "failed to get workflow run status");
    return NextResponse.json(
      { error: "Workflow status unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
