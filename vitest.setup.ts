import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

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

// Mock ResizeObserver for jsdom environment
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};
