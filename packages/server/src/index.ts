/**
 * @domainstack/server
 *
 * Server-side services for domain data fetching.
 * Replaces workflow-based implementations with simple async functions.
 *
 * Retry logic is intentionally omitted - TanStack Query handles retries on the frontend.
 */

export * from "./services/registration";
export * from "./swr";
