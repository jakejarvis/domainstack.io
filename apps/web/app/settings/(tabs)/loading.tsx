import { SettingsTabsRouter } from "@/components/settings/settings-content";
import { SettingsSkeletonPanels } from "@/components/settings/settings-skeleton";

export default function SettingsLoading() {
  return (
    <SettingsTabsRouter navigationMode="page">
      <SettingsSkeletonPanels />
    </SettingsTabsRouter>
  );
}
