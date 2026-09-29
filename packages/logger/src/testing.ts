/**
 * Test doubles for @domainstack/logger. Import only from vitest setup files:
 *   vi.mock("@domainstack/logger", async () =>
 *     (await import("@domainstack/logger/testing")).mockLoggerModule());
 */
import { vi } from "vitest";

export type MockLogger = Record<
  "log" | "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "child",
  ReturnType<typeof vi.fn>
>;

export function createMockLogger(): MockLogger {
  return {
    log: vi.fn<(...args: unknown[]) => void>(),
    trace: vi.fn<(...args: unknown[]) => void>(),
    debug: vi.fn<(...args: unknown[]) => void>(),
    info: vi.fn<(...args: unknown[]) => void>(),
    warn: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
    fatal: vi.fn<(...args: unknown[]) => void>(),
    child: vi.fn<(...args: unknown[]) => MockLogger>(() => createMockLogger()),
  };
}

export function mockLoggerModule() {
  return {
    logger: createMockLogger(),
    createLogger: vi.fn<(...args: unknown[]) => MockLogger>(() => createMockLogger()),
  };
}
