import { setupServer } from "msw/node";

/**
 * Shared MSW server for web node tests. It starts with no handlers, so any
 * unmocked outbound request fails the test (`onUnhandledRequest: "error"` in
 * `vitest.setup.node.ts`). Register what a test needs with `server.use(...)`.
 */
export const server = setupServer();
