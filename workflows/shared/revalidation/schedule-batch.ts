/**
 * Batch revalidation scheduling step.
 *
 * Schedules revalidation for multiple sections in a single Inngest API call.
 * Use this at the end of workflows that update multiple sections to reduce
 * API overhead compared to scheduling each section individually.
 */

import type { Section } from "@/lib/constants/sections";

/**
 * Step: Schedule revalidation for multiple sections.
 *
 * Uses a single Inngest API call to schedule all sections, which is more
 * efficient than calling scheduleRevalidation() for each section.
 *
 * @param domain - The domain to revalidate
 * @param sections - The sections to schedule for revalidation
 * @param lastAccessedAt - When the domain was last accessed (for decay calculation)
 */
export async function scheduleRevalidationBatchStep(
  domain: string,
  sections: Section[],
  lastAccessedAt: Date | null,
): Promise<void> {
  "use step";

  const { scheduleRevalidationBatch } = await import("@/lib/revalidation");

  await scheduleRevalidationBatch(domain, sections, lastAccessedAt);
}
