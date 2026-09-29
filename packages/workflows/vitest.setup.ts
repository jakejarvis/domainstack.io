import { vi } from "vitest";

// Mock logger to avoid noise in tests
vi.mock("@domainstack/logger", async () =>
  (await import("@domainstack/logger/testing")).mockLoggerModule(),
);
