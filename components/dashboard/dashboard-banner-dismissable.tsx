"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";

export function DashboardBannerDismissable(
  props: React.ComponentProps<typeof DashboardBanner>,
) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <DashboardBanner {...props} onDismiss={() => setIsDismissed(true)} />
      </motion.div>
    </AnimatePresence>
  );
}
