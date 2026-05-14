/**
 * Sections that make up the public domain report. Used to deep-link from
 * notifications and other entrypoints to a specific section of the report.
 */
export const REPORT_SECTIONS = [
  "registration",
  "hosting",
  "dns",
  "certificates",
  "headers",
  "seo",
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];
