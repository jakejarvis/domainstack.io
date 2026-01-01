import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { autoVerifyPendingDomain } from "@/lib/inngest/functions/auto-verify-pending-domain";
import { checkCertificateExpiryScheduler } from "@/lib/inngest/functions/check-certificate-expiry/scheduler";
import { checkCertificateExpiryWorker } from "@/lib/inngest/functions/check-certificate-expiry/worker";
import { checkDomainExpiryScheduler } from "@/lib/inngest/functions/check-domain-expiry/scheduler";
import { checkDomainExpiryWorker } from "@/lib/inngest/functions/check-domain-expiry/worker";
import { checkSubscriptionExpiryScheduler } from "@/lib/inngest/functions/check-subscription-expiry/scheduler";
import { checkSubscriptionExpiryWorker } from "@/lib/inngest/functions/check-subscription-expiry/worker";
import { cleanupStaleDomains } from "@/lib/inngest/functions/cleanup-stale-domains";
import { initializeSnapshot } from "@/lib/inngest/functions/initialize-snapshot";
import { monitorTrackedDomainsScheduler } from "@/lib/inngest/functions/monitor-tracked-domains/scheduler";
import { monitorTrackedDomainsWorker } from "@/lib/inngest/functions/monitor-tracked-domains/worker";
import { reverifyDomainsScheduler } from "@/lib/inngest/functions/reverify-domains/scheduler";
import {
  reverifyOwnershipWorker,
  verifyPendingDomainCronWorker,
} from "@/lib/inngest/functions/reverify-domains/worker";
import { sectionRevalidate } from "@/lib/inngest/functions/section-revalidate";
import { syncScreenshotBlocklist } from "@/lib/inngest/functions/sync-screenshot-blocklist";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sectionRevalidate,
    cleanupStaleDomains,
    syncScreenshotBlocklist,
    autoVerifyPendingDomain,
    initializeSnapshot,
    // Monitoring System (Fan-out)
    monitorTrackedDomainsScheduler,
    monitorTrackedDomainsWorker,
    // Verification System (Fan-out)
    reverifyDomainsScheduler,
    verifyPendingDomainCronWorker,
    reverifyOwnershipWorker,
    // Expiry Checks (Fan-out)
    checkDomainExpiryScheduler,
    checkDomainExpiryWorker,
    checkCertificateExpiryScheduler,
    checkCertificateExpiryWorker,
    checkSubscriptionExpiryScheduler,
    checkSubscriptionExpiryWorker,
  ],
});
