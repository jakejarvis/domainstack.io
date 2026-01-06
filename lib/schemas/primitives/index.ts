/**
 * Primitive schemas - Layer 0 (zero internal imports)
 *
 * These schemas have no dependencies on other internal modules.
 * They serve as the source of truth for enums and basic types.
 * db/schema.ts derives pgEnums from these schemas.
 */

export * from "./dns-record-type";
export * from "./provider-category";
export * from "./provider-ref";
export * from "./provider-source";
export * from "./registration-contacts";
export * from "./registration-source";
export * from "./user-tier";
export * from "./verification-method";
export * from "./verification-status";
