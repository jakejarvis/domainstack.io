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

// Mock ResizeObserver for jsdom environment
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};
