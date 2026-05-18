/* @vitest-environment node */
import type { Query } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { describe, expect, it } from "vitest";

import {
  deserializeQueryClient,
  serializeQueryClient,
  shouldDehydrateQuery,
} from "./query-persister";

// Regression: the tRPC client decodes responses with superjson, so the query
// cache holds real Date objects (tracked-domain expiry, subscription period
// end, notification timestamps, …). If the persister fell back to plain JSON,
// these would rehydrate as strings on the cold-start-with-warm-cache path and
// every `.getTime()` / Intl.DateTimeFormat() call on them would break.
describe("query persister serialization", () => {
  const created = new Date("2024-01-15T08:30:00.000Z");
  const expires = new Date("2027-06-01T00:00:00.000Z");

  function makeClient(): PersistedClient {
    return {
      buster: "test",
      timestamp: Date.now(),
      clientState: {
        mutations: [],
        queries: [
          {
            queryKey: ["tracking", "listDomains"],
            queryHash: '["tracking","listDomains"]',
            state: {
              data: [{ domain: "example.com", createdAt: created, expirationDate: expires }],
              dataUpdateCount: 1,
              dataUpdatedAt: Date.now(),
              error: null,
              errorUpdateCount: 0,
              errorUpdatedAt: 0,
              fetchFailureCount: 0,
              fetchFailureReason: null,
              fetchMeta: null,
              isInvalidated: false,
              status: "success",
              fetchStatus: "idle",
            },
          },
        ],
      },
    } as PersistedClient;
  }

  function firstRow(client: PersistedClient): { createdAt: unknown; expirationDate: unknown } {
    const query = client.clientState.queries[0];
    if (!query) throw new Error("expected one persisted query");
    const data = query.state.data as Array<{ createdAt: unknown; expirationDate: unknown }>;
    const row = data[0];
    if (!row) throw new Error("expected one tracked domain");
    return row;
  }

  it("round-trips Date values through serialize/deserialize", () => {
    const row = firstRow(deserializeQueryClient(serializeQueryClient(makeClient())));

    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.expirationDate).toBeInstanceOf(Date);
    expect((row.createdAt as Date).getTime()).toBe(created.getTime());
    expect((row.expirationDate as Date).getTime()).toBe(expires.getTime());
  });

  it("would lose Date types under plain JSON (documents the bug being guarded)", () => {
    const row = firstRow(JSON.parse(JSON.stringify(makeClient())) as PersistedClient);

    expect(row.createdAt).not.toBeInstanceOf(Date);
    expect(typeof row.createdAt).toBe("string");
  });
});

// Regression: an optimistic mutation marks queries invalidated, then onSettled
// refetches to reconcile. If that refetch is interrupted (offline / app killed)
// the un-reconciled optimistic snapshot must NOT be persisted — otherwise e.g.
// a "mark all read" empty inbox + unreadCount 0 survives the next cold start.
describe("shouldDehydrateQuery", () => {
  function query(status: string, isInvalidated: boolean): Query {
    return {
      state: { status, fetchStatus: "idle", isInvalidated, data: {} },
    } as unknown as Query;
  }

  it("persists a settled successful query", () => {
    expect(shouldDehydrateQuery(query("success", false))).toBe(true);
  });

  it("does NOT persist a successful query still flagged invalidated", () => {
    expect(shouldDehydrateQuery(query("success", true))).toBe(false);
  });

  it("does NOT persist pending or errored queries", () => {
    expect(shouldDehydrateQuery(query("pending", false))).toBe(false);
    expect(shouldDehydrateQuery(query("error", false))).toBe(false);
  });
});
