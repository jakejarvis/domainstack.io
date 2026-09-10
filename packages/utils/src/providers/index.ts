/**
 * Provider detection and catalog module.
 *
 * Exports functions for detecting providers from various signals
 * (HTTP headers, DNS records, certificate issuers, registrar names).
 */

// Detection functions
export * from "./detection";
// Catalog parsing and types
export * from "./parser";
// Rules and evaluation
export * from "./rules";
