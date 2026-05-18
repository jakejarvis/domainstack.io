import Animated, { FadeIn } from "react-native-reanimated";

import { GroupedSection } from "./form/group";

/**
 * Domain report section. A thin alias over {@link GroupedSection} (padded
 * mode) so the report speaks the same inset-grouped language as Settings.
 * Fades in as its Suspense boundary resolves so sections don't pop in.
 */
export function ReportSection({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <GroupedSection padded title={title} trailing={trailing}>
        {children}
      </GroupedSection>
    </Animated.View>
  );
}
