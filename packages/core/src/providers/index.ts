/**
 * Provider detection and catalog module.
 *
 * Exports functions for detecting providers from various signals
 * (HTTP headers, DNS records, certificate issuers, registrar names).
 */

// Default catalog
export * from "./catalog";
// Detection functions
export * from "./detection";
// Catalog parsing and types
export * from "./parser";
// Rules and evaluation
export * from "./rules";
