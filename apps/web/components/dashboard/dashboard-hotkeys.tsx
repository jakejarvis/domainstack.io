import { useDashboardHotkeys } from "@/hooks/use-dashboard-hotkeys";

/** Isolates hotkey subscriptions from the rendered grid and table. */
export function DashboardHotkeys() {
  useDashboardHotkeys();
  return null;
}
