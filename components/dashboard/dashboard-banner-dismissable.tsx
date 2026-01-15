"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";

export function DashboardBannerDismissable(
  props: React.ComponentProps<typeof DashboardBanner>,
) {
  const shouldReduceMotion = useReducedMotion();
  const [isDismissed, setIsDismissed] = useState(false);

  return (
    <AnimatePresence mode="wait">
      {!isDismissed && (
        <motion.div
          key="banner"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
          transition={{
            duration: shouldReduceMotion ? 0.1 : 0.2,
            ease: "easeInOut",
          }}
        >
          <DashboardBanner {...props} onDismiss={() => setIsDismissed(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
