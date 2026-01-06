/**
 * Schema exports - organized by layer to prevent circular dependencies.
 *
 * Layer 0: Primitives (zero internal imports)
 * Layer 1: Domain schemas (import only primitives)
 * Layer 2: Internal/composite schemas (can import primitives + domain)
 *
 * db/schema.ts derives pgEnums from primitives - schemas are source of truth.
 */

// Layer 1: Domain schemas
export * from "./domain/certificates";
export * from "./domain/dns";
export * from "./domain/headers";
export * from "./domain/hosting";
export * from "./domain/pricing";
export * from "./domain/registration";
export * from "./domain/seo";
// Layer 2: Internal/composite schemas
export * from "./internal/blob";
export * from "./internal/changes";
export * from "./internal/icons";
export * from "./internal/notifications";
export * from "./internal/provider";
export * from "./internal/sections";
export * from "./internal/snapshot";
export * from "./internal/stats";
export * from "./internal/subscription";
export * from "./internal/verification";
// Layer 0: Primitives (enums and basic types with zero internal imports)
export * from "./primitives";
