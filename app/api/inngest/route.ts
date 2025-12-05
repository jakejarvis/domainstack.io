import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { checkCertificateExpiry } from "@/lib/inngest/functions/check-certificate-expiry";
import { checkDomainExpiry } from "@/lib/inngest/functions/check-domain-expiry";
import { checkSubscriptionExpiry } from "@/lib/inngest/functions/check-subscription-expiry";
import { reverifyDomains } from "@/lib/inngest/functions/reverify-domains";
import { sectionRevalidate } from "@/lib/inngest/functions/section-revalidate";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sectionRevalidate,
    checkDomainExpiry,
    checkCertificateExpiry,
    checkSubscriptionExpiry,
    reverifyDomains,
  ],
});
