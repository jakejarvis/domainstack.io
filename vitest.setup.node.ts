import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import "./vitest.setup.common";

// Mock ResizeObserver if needed (likely not in Node env, but harmless)
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Mock Web Animations API
if (typeof Element !== "undefined") {
  Element.prototype.getAnimations = vi.fn(() => []);
}
