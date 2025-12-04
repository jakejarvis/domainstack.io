import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { checkDomainExpiry } from "@/lib/inngest/functions/check-domain-expiry";
import { reverifyDomains } from "@/lib/inngest/functions/reverify-domains";
import { sectionRevalidate } from "@/lib/inngest/functions/section-revalidate";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sectionRevalidate, checkDomainExpiry, reverifyDomains],
});
