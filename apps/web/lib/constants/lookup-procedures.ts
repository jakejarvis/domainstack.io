import type { Section } from "@domainstack/constants";

/**
 * The tRPC `domain.*` procedure that serves each report section. Exhaustive, so
 * a new section can't be added without wiring its procedure.
 */
export const LOOKUP_PROCEDURES = {
  registration: "getRegistration",
  dns: "getDnsRecords",
  hosting: "getHosting",
  certificates: "getCertificates",
  headers: "getHeaders",
  seo: "getSeo",
} as const satisfies Record<Section, string>;
