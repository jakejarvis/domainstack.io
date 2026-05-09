import { start } from "workflow/api";

import { providers as pricingProviders } from "@/lib/pricing";
import { autoVerifyWorkflow } from "@/workflows/auto-verify";
import { initializeSnapshotWorkflow } from "@/workflows/initialize-snapshot";
import { verificationWorkflow } from "@/workflows/verification";
import { createAppRouter, createCallerFactoryForAppRouter } from "@domainstack/api";

export const appRouter = createAppRouter({
  pricingProviders,
  tracking: {
    startAutoVerify: async ({ trackedDomainId }) => {
      await start(autoVerifyWorkflow, [{ trackedDomainId }]);
    },
    startInitializeSnapshot: async ({ trackedDomainId, domainId }) => {
      await start(initializeSnapshotWorkflow, [{ trackedDomainId, domainId }]);
    },
    runVerification: async (input) => {
      const run = await start(verificationWorkflow, [input]);
      return await run.returnValue;
    },
  },
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactoryForAppRouter(appRouter);
