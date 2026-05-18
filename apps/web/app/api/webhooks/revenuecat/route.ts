import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { handleRevenueCatEvent, type RevenueCatWebhookBody } from "@domainstack/billing/revenuecat";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "webhooks/revenuecat" });

/** Constant-time compare for equal-length strings (length mismatch returns early). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * RevenueCat webhook endpoint.
 *
 * RevenueCat sends the Authorization header verbatim as configured in its
 * dashboard (NOT a `Bearer` prefix) — match it exactly against
 * `REVENUECAT_WEBHOOK_SECRET`. Returns non-2xx on handler failure so
 * RevenueCat retries (events are delivered at-least-once with backoff).
 */
export async function POST(request: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn("RevenueCat webhook hit but REVENUECAT_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 501 });
  }

  const auth = request.headers.get("Authorization");
  if (!auth || !safeEqual(auth, secret)) {
    logger.warn("Unauthorized RevenueCat webhook request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RevenueCatWebhookBody;
  try {
    body = (await request.json()) as RevenueCatWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.event?.type) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  try {
    await handleRevenueCatEvent(body.event);
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error({ err, type: body.event.type }, "RevenueCat webhook handler failed");
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
