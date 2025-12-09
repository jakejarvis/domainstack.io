/**
 * Shared types for PostHog analytics (client and server).
 */

/**
 * User properties that can be updated on each identify call ($set).
 * These properties will be overwritten on subsequent identify calls.
 */
export type IdentifyProperties = {
  email?: string;
  name?: string;
  tier?: string;
};

/**
 * User properties that should only be set once ($set_once).
 * These properties will not be overwritten on subsequent identify calls.
 */
export type IdentifySetOnceProperties = {
  createdAt?: string;
};
