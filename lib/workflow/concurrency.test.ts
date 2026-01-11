import { describe, expect, it } from "vitest";
import { WorkflowAPIError } from "workflow/internal/errors";
import {
  handleStepConcurrencyError,
  isConcurrencyConflict,
  wasAlreadyHandled,
} from "./concurrency";

describe("isConcurrencyConflict", () => {
  it("returns true for 409 WorkflowAPIError with 'error already exists' message", () => {
    const error = new WorkflowAPIError(
      "Cannot set error for workflow step abc123 because error already exists. Error can only be set once.",
      { status: 409 },
    );
    expect(isConcurrencyConflict(error)).toBe(true);
  });

  it("returns true for 409 WorkflowAPIError with 'result already exists' message", () => {
    const error = new WorkflowAPIError(
      "Cannot set result for workflow step abc123 because result already exists.",
      { status: 409 },
    );
    expect(isConcurrencyConflict(error)).toBe(true);
  });

  it("returns true for 409 WorkflowAPIError with 'Cannot set' message", () => {
    const error = new WorkflowAPIError(
      "Cannot set value for step because it was already processed",
      { status: 409 },
    );
    expect(isConcurrencyConflict(error)).toBe(true);
  });

  it("returns false for non-409 WorkflowAPIError", () => {
    const error = new WorkflowAPIError("Server error", { status: 500 });
    expect(isConcurrencyConflict(error)).toBe(false);
  });

  it("returns false for 409 with unrelated message", () => {
    const error = new WorkflowAPIError("Resource conflict - please retry", {
      status: 409,
    });
    expect(isConcurrencyConflict(error)).toBe(false);
  });

  it("returns false for regular Error", () => {
    const error = new Error("Some error");
    expect(isConcurrencyConflict(error)).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isConcurrencyConflict(null)).toBe(false);
    expect(isConcurrencyConflict(undefined)).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isConcurrencyConflict("error")).toBe(false);
    expect(isConcurrencyConflict(409)).toBe(false);
    expect(isConcurrencyConflict({ status: 409 })).toBe(false);
  });
});

describe("handleStepConcurrencyError", () => {
  it("returns 'already_handled' for concurrency conflicts", () => {
    const error = new WorkflowAPIError(
      "Cannot set error for workflow step abc123 because error already exists.",
      { status: 409 },
    );
    const result = handleStepConcurrencyError(error, { domain: "example.com" });
    expect(result).toBe("already_handled");
  });

  it("re-throws non-concurrency errors", () => {
    const error = new Error("Database connection failed");
    expect(() =>
      handleStepConcurrencyError(error, { domain: "example.com" }),
    ).toThrow("Database connection failed");
  });

  it("re-throws 500 WorkflowAPIError", () => {
    const error = new WorkflowAPIError("Internal server error", {
      status: 500,
    });
    expect(() => handleStepConcurrencyError(error)).toThrow(
      "Internal server error",
    );
  });
});

describe("wasAlreadyHandled", () => {
  it("returns true for 'already_handled' string", () => {
    expect(wasAlreadyHandled("already_handled")).toBe(true);
  });

  it("returns false for other values", () => {
    expect(wasAlreadyHandled(undefined)).toBe(false);
    expect(wasAlreadyHandled(null)).toBe(false);
    expect(wasAlreadyHandled({ data: "test" })).toBe(false);
    expect(wasAlreadyHandled("other_string")).toBe(false);
  });
});

describe("withConcurrencyHandling", () => {
  it("returns the result for successful operations", async () => {
    const { withConcurrencyHandling } = await import("./concurrency");
    const result = await withConcurrencyHandling(
      Promise.resolve({ data: "test" }),
      { domain: "example.com" },
    );
    expect(result).toEqual({ data: "test" });
  });

  it("returns undefined for concurrency conflicts", async () => {
    const { withConcurrencyHandling } = await import("./concurrency");
    const error = new WorkflowAPIError(
      "Cannot set error for workflow step abc123 because error already exists.",
      { status: 409 },
    );
    const result = await withConcurrencyHandling(Promise.reject(error), {
      domain: "example.com",
    });
    expect(result).toBeUndefined();
  });

  it("re-throws non-concurrency errors", async () => {
    const { withConcurrencyHandling } = await import("./concurrency");
    const error = new Error("Database connection failed");
    await expect(
      withConcurrencyHandling(Promise.reject(error), { domain: "example.com" }),
    ).rejects.toThrow("Database connection failed");
  });

  it("re-throws 500 WorkflowAPIError", async () => {
    const { withConcurrencyHandling } = await import("./concurrency");
    const error = new WorkflowAPIError("Internal server error", {
      status: 500,
    });
    await expect(
      withConcurrencyHandling(Promise.reject(error), {}),
    ).rejects.toThrow("Internal server error");
  });
});

describe("isWorkflowConflictError", () => {
  it("returns true for 409 concurrency conflicts", async () => {
    const { isWorkflowConflictError } = await import("./concurrency");
    const error = new WorkflowAPIError(
      "Cannot set error for workflow step because error already exists.",
      { status: 409 },
    );
    expect(isWorkflowConflictError(error)).toBe(true);
  });

  it("returns false for other errors", async () => {
    const { isWorkflowConflictError } = await import("./concurrency");
    expect(isWorkflowConflictError(new Error("test"))).toBe(false);
    expect(
      isWorkflowConflictError(
        new WorkflowAPIError("Server error", { status: 500 }),
      ),
    ).toBe(false);
  });
});
