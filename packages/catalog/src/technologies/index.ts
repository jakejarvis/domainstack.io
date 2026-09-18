/**
 * Technology detection module.
 *
 * A pure matcher over the technology catalog. Callers build the
 * TechDetectionContext (see @domainstack/core) and get back every technology
 * whose rule matches.
 */

export * from "./detect";
export * from "./parser";
export * from "./rules";
