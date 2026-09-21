import { describe, expect, it } from "vitest";
import { FatalError, RetryableError } from "workflow";

import { classifyDatabaseError } from "./errors";

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
});
