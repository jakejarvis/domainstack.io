// Polyfill process for happy-dom environment (must be before other imports)
// Next.js code uses process.env.* which may not exist
if (typeof globalThis.process === "undefined") {
  globalThis.process = {
    env: {
      NODE_ENV: "test",
      NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "",
      EXTERNAL_USER_AGENT: "",
    },
  } as unknown as NodeJS.Process;
}

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Clean up DOM after each test
afterEach(() => {
  cleanup();
});

// Global mocks for analytics to avoid network/log noise in tests
vi.mock("@/lib/analytics/server", () => ({
  analytics: {
    track: vi.fn(async () => undefined),
    trackException: vi.fn(async () => undefined),
  },
}));
vi.mock("@/lib/analytics/client", () => ({
  analytics: {
    track: vi.fn(),
    trackException: vi.fn(),
  },
  useAnalytics: () => ({
    track: vi.fn(),
    trackException: vi.fn(),
  }),
}));

// Make server-only a no-op so we can import server modules in tests
vi.mock("server-only", () => ({}));

// Mock logger to avoid noise in tests
const createMockLogger = () => ({
  log: vi.fn(),
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

vi.mock("@/lib/logger/server", () => ({
  logger: createMockLogger(),
  createLogger: vi.fn(() => createMockLogger()),
}));

vi.mock("@/lib/logger/client", () => ({
  logger: createMockLogger(),
  createLogger: vi.fn(() => createMockLogger()),
}));

// Mock Next.js after() to execute callbacks immediately in tests
// In production, after() schedules work after the response is sent
vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      // Execute immediately in tests and return promise for proper test awaiting
      // Swallow errors like production after() does
      return Promise.resolve(callback()).catch(() => {
        // Error silently handled
      });
    },
  };
});

// Mock Next.js cache functions that require cacheComponents config
// These are no-ops in tests since we don't need actual caching behavior
vi.mock("next/cache", async () => {
  const actual =
    await vi.importActual<typeof import("next/cache")>("next/cache");
  return {
    ...actual,
    cacheLife: vi.fn(),
    cacheTag: vi.fn(),
  };
});

// Happy-dom provides native support for:
// - ResizeObserver
// - Element.getAnimations()
// - All Web APIs
// So we don't need polyfills like jsdom did.

// However, happy-dom may still need some polyfills for specific APIs
// that aren't fully implemented. Add them here as needed.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof Element.prototype.getAnimations === "undefined") {
  Element.prototype.getAnimations = () => [];
}
