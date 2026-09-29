import { prefetchSettingsQueries } from "@/components/settings/prefetch";
import { SettingsPanels, SettingsTabsRouter } from "@/components/settings/settings-content";
import { getServerSession } from "@/lib/auth/session";
import { HydrateClient } from "@/trpc/server";

export default async function SettingsTabsLayout() {
  const [session] = await Promise.all([getServerSession(), prefetchSettingsQueries()]);

  return (
    <HydrateClient>
      <SettingsTabsRouter navigationMode="page">
        <SettingsPanels userEmail={session?.user.email ?? ""} />
      </SettingsTabsRouter>
    </HydrateClient>
  );
}
