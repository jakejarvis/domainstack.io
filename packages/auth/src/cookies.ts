/**
 * Edge-safe session-cookie check for the proxy. Kept separate from `./server`,
 * which boots Better Auth, the database, and the Polar plugin at import time.
 */
export { getSessionCookie } from "better-auth/cookies";
