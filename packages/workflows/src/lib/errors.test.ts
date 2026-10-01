import { describe, expect, it } from "vitest";
import { FatalError, RetryableError } from "workflow";

import { classifyDatabaseError } from "./errors";

/** Shape of drizzle-orm's DrizzleQueryError: SQL + params in the message, pg error on `cause`. */
function drizzleError(pg: { message: string; code: string }, params: unknown[] = []) {
  const cause = Object.assign(new Error(pg.message), { code: pg.code });
  return Object.assign(
    new Error(
      `Failed query: insert into "registrations" ("raw_response") values ($1)\nparams: ${params.join(",")}`,
    ),
    { cause },
  );
}

describe("classifyDatabaseError", () => {
  it("passes through an existing FatalError", () => {
    const err = new FatalError("already fatal");
    expect(classifyDatabaseError(err)).toBe(err);
  });

  it("passes through an existing RetryableError", () => {
    const err = new RetryableError("already retryable");
    expect(classifyDatabaseError(err)).toBe(err);
  });

  it("classifies connection errors as retryable, keeping the original message for diagnostics", () => {
    const result = classifyDatabaseError(new Error("Connection terminated unexpectedly"));
    expect(RetryableError.is(result)).toBe(true);
    expect(result.message).toBe(
      "database operation: connection error - Connection terminated unexpectedly",
    );
  });

  it("classifies deadlocks as retryable with the given context, keeping the original message", () => {
    const result = classifyDatabaseError(new Error("deadlock detected"), {
      context: "persisting x",
    });
    expect(RetryableError.is(result)).toBe(true);
    expect(result.message).toBe("persisting x: deadlock - deadlock detected");
  });

  it("classifies constraint violations as fatal", () => {
    const result = classifyDatabaseError(
      new Error('duplicate key value violates unique constraint "pk"'),
    );
    expect(FatalError.is(result)).toBe(true);
    expect(result.message).toMatch(/^database operation: constraint violation/);
  });

  it("classifies schema errors as fatal", () => {
    const result = classifyDatabaseError(new Error('relation "foo" does not exist'));
    expect(FatalError.is(result)).toBe(true);
    expect(result.message).toContain("schema error");
  });

  it("classifies other errors as retryable", () => {
    const result = classifyDatabaseError(new Error("something odd"));
    expect(RetryableError.is(result)).toBe(true);
    expect(result.message).toBe("database operation: something odd");
  });

  it("classifies a non-Error value as retryable", () => {
    const result = classifyDatabaseError("boom");
    expect(RetryableError.is(result)).toBe(true);
    expect(result.message).toBe("database operation: boom");
  });

  it("checks the connection rule before the constraint rule", () => {
    const result = classifyDatabaseError(
      new Error("connection lost during unique constraint check"),
    );
    expect(RetryableError.is(result)).toBe(true);
  });

  describe("drizzle-wrapped postgres errors", () => {
    it("classifies a unique violation (23505) as fatal without leaking the SQL", () => {
      const result = classifyDatabaseError(
        drizzleError({
          code: "23505",
          message: 'duplicate key value violates unique constraint "pk"',
        }),
      );
      expect(FatalError.is(result)).toBe(true);
      expect(result.message).toMatch(/^database operation: constraint violation/);
      expect(result.message).not.toContain("Failed query");
    });

    it("ignores keywords in the bound params when the SQLSTATE says connection failure (08006)", () => {
      const result = classifyDatabaseError(
        drizzleError({ code: "08006", message: "connection failure" }, [
          "No match for domain: the object does not exist",
        ]),
      );
      expect(RetryableError.is(result)).toBe(true);
    });

    it("classifies a deadlock (40P01) as retryable", () => {
      const result = classifyDatabaseError(
        drizzleError({ code: "40P01", message: "deadlock detected" }),
      );
      expect(RetryableError.is(result)).toBe(true);
      expect(result.message).toBe("database operation: deadlock - deadlock detected");
    });

    it("classifies an undefined table (42P01) as a fatal schema error", () => {
      const result = classifyDatabaseError(
        drizzleError({ code: "42P01", message: 'relation "x" does not exist' }),
      );
      expect(FatalError.is(result)).toBe(true);
      expect(result.message).toContain("schema error");
    });

    it("classifies a statement timeout (57014) as retryable", () => {
      const result = classifyDatabaseError(
        drizzleError({ code: "57014", message: "canceling statement due to statement timeout" }),
      );
      expect(RetryableError.is(result)).toBe(true);
    });

    it("classifies a data exception (22001) as fatal", () => {
      const result = classifyDatabaseError(
        drizzleError({ code: "22001", message: "value too long for type character varying(255)" }),
      );
      expect(FatalError.is(result)).toBe(true);
    });

    it("classifies a node socket error code (ECONNREFUSED) on the cause as a retryable connection error", () => {
      const cause = Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:5432"), {
        code: "ECONNREFUSED",
      });
      const wrapper = Object.assign(new Error("Failed query: select 1\nparams: "), { cause });
      const result = classifyDatabaseError(wrapper);
      expect(RetryableError.is(result)).toBe(true);
      expect(result.message).toContain("connection error");
    });

    it("does not mistake the node socket code EPIPE for a SQLSTATE", () => {
      const cause = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
      const wrapper = Object.assign(new Error("Failed query: select 1\nparams: "), { cause });
      const result = classifyDatabaseError(wrapper);
      expect(RetryableError.is(result)).toBe(true);
      expect(result.message).toBe("database operation: connection error - write EPIPE");
    });

    it("reads keywords from the cause, not the wrapper, when there is no SQLSTATE", () => {
      const cause = new Error("Connection terminated unexpectedly");
      const wrapper = Object.assign(new Error("Failed query: select 1\nparams: relation"), {
        cause,
      });
      const result = classifyDatabaseError(wrapper);
      expect(RetryableError.is(result)).toBe(true);
    });

    it("defaults to retryable for a wrapper with no cause, without echoing its params", () => {
      const result = classifyDatabaseError(
        new Error("Failed query: select 1\nparams: does not exist"),
      );
      expect(RetryableError.is(result)).toBe(true);
      expect(result.message).not.toContain("params:");
    });
  });
});
