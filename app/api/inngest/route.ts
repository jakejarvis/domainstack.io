import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { autoVerifyPendingDomain } from "@/lib/inngest/functions/auto-verify-pending-domain";
import { initializeSnapshot } from "@/lib/inngest/functions/initialize-snapshot";
import { sectionRevalidate } from "@/lib/inngest/functions/section-revalidate";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Event-driven functions (trigger workflows)
    sectionRevalidate,
    autoVerifyPendingDomain,
    initializeSnapshot,
  ],
});
