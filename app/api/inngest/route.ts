import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { autoVerifyPendingDomain } from "@/lib/inngest/functions/auto-verify-pending-domain";
import { checkCertificateExpiryScheduler } from "@/lib/inngest/functions/check-certificate-expiry/scheduler";
import { checkDomainExpiryScheduler } from "@/lib/inngest/functions/check-domain-expiry/scheduler";
import { checkSubscriptionExpiryScheduler } from "@/lib/inngest/functions/check-subscription-expiry/scheduler";
import { cleanupStaleDomains } from "@/lib/inngest/functions/cleanup-stale-domains";
import { initializeSnapshot } from "@/lib/inngest/functions/initialize-snapshot";
import { monitorTrackedDomainsScheduler } from "@/lib/inngest/functions/monitor-tracked-domains/scheduler";
import { reverifyDomainsScheduler } from "@/lib/inngest/functions/reverify-domains/scheduler";
import { sectionRevalidate } from "@/lib/inngest/functions/section-revalidate";
import { syncScreenshotBlocklist } from "@/lib/inngest/functions/sync-screenshot-blocklist";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Event-driven functions (trigger workflows)
    sectionRevalidate,
    autoVerifyPendingDomain,
    initializeSnapshot,
    // Cron schedulers (trigger workflows in batches)
    cleanupStaleDomains,
    syncScreenshotBlocklist,
    monitorTrackedDomainsScheduler,
    reverifyDomainsScheduler,
    checkDomainExpiryScheduler,
    checkCertificateExpiryScheduler,
    checkSubscriptionExpiryScheduler,
  ],
});
