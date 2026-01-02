import { useState } from "react";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";

export function DashboardBannerDismissable(
  props: React.ComponentProps<typeof DashboardBanner>,
) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return <DashboardBanner {...props} onDismiss={() => setIsDismissed(true)} />;
}
