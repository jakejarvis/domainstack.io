import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Inngest client before importing
vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import {
  trackWorkflowFailure,
  trackWorkflowFailureAsync,
} from "./observability";

describe("trackWorkflowFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends failure event to Inngest", async () => {
    await trackWorkflowFailure({
      workflow: "registration",
      domain: "example.com",
      error: new Error("RDAP server timeout"),
      classification: "retries_exhausted",
    });

    expect(inngest.send).toHaveBeenCalledTimes(1);
    expect(inngest.send).toHaveBeenCalledWith({
      name: INNGEST_EVENTS.WORKFLOW_FAILED,
      data: expect.objectContaining({
        workflow: "registration",
        domain: "example.com",
        error: "RDAP server timeout",
        classification: "retries_exhausted",
        failedAt: expect.any(String),
      }),
    });
  });

  it("includes section in payload when provided", async () => {
    await trackWorkflowFailure({
      workflow: "section-revalidate",
      domain: "example.com",
      section: "dns",
      error: "DNS resolution failed",
      classification: "fatal",
    });

    expect(inngest.send).toHaveBeenCalledWith({
      name: INNGEST_EVENTS.WORKFLOW_FAILED,
      data: expect.objectContaining({
        workflow: "section-revalidate",
        domain: "example.com",
        section: "dns",
        error: "DNS resolution failed",
        classification: "fatal",
      }),
    });
  });

  it("includes context in payload when provided", async () => {
    await trackWorkflowFailure({
      workflow: "headers",
      domain: "example.com",
      error: new Error("Connection refused"),
      classification: "fatal",
      context: {
        ip: "192.0.2.1",
        port: 443,
        attempt: 3,
      },
    });

    expect(inngest.send).toHaveBeenCalledWith({
      name: INNGEST_EVENTS.WORKFLOW_FAILED,
      data: expect.objectContaining({
        context: {
          ip: "192.0.2.1",
          port: 443,
          attempt: 3,
        },
      }),
    });
  });

  it("handles string errors", async () => {
    await trackWorkflowFailure({
      workflow: "dns",
      domain: "example.com",
      error: "Network error",
      classification: "retries_exhausted",
    });

    expect(inngest.send).toHaveBeenCalledWith({
      name: INNGEST_EVENTS.WORKFLOW_FAILED,
      data: expect.objectContaining({
        error: "Network error",
      }),
    });
  });

  it("continues even if Inngest send fails", async () => {
    vi.mocked(inngest.send).mockRejectedValueOnce(
      new Error("Inngest unavailable"),
    );

    // Should not throw
    await expect(
      trackWorkflowFailure({
        workflow: "registration",
        domain: "example.com",
        error: "Some error",
        classification: "fatal",
      }),
    ).resolves.toBeUndefined();
  });

  it("works without domain (for system-level failures)", async () => {
    await trackWorkflowFailure({
      workflow: "cron-cleanup",
      error: new Error("Database connection lost"),
      classification: "fatal",
    });

    expect(inngest.send).toHaveBeenCalledWith({
      name: INNGEST_EVENTS.WORKFLOW_FAILED,
      data: expect.objectContaining({
        workflow: "cron-cleanup",
        domain: undefined,
        error: "Database connection lost",
      }),
    });
  });
});

describe("trackWorkflowFailureAsync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends failure event without awaiting", () => {
    // Fire and forget - should not throw
    trackWorkflowFailureAsync({
      workflow: "registration",
      domain: "example.com",
      error: new Error("Timeout"),
      classification: "retries_exhausted",
    });

    // The send should be called (eventually)
    // Since it's async, we need to wait a tick
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(inngest.send).toHaveBeenCalled();
        resolve();
      }, 0);
    });
  });

  it("swallows errors silently", () => {
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("Inngest down"));

    // Should not throw
    expect(() =>
      trackWorkflowFailureAsync({
        workflow: "dns",
        error: "Error",
        classification: "fatal",
      }),
    ).not.toThrow();
  });
});
