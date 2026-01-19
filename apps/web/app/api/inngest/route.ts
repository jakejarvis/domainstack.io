import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sectionRevalidate } from "@/lib/inngest/functions/section-revalidate";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sectionRevalidate],
});
