import { MapSkeleton } from "@/components/domain/hosting/map-skeleton";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { Section } from "@/components/domain/section";
import { sections } from "@/lib/sections-meta";

export function HostingSectionSkeleton() {
  return (
    <Section {...sections.hosting} isLoading>
      <KeyValueGrid colsDesktop={3}>
        <KeyValueSkeleton label="DNS" withLeading widthClass="w-[100px]" />
        <KeyValueSkeleton label="Hosting" withLeading widthClass="w-[100px]" />
        <KeyValueSkeleton label="Email" withLeading widthClass="w-[100px]" />
      </KeyValueGrid>

      <KeyValueSkeleton label="Location" withLeading widthClass="w-[220px]" />

      <MapSkeleton />
    </Section>
  );
}
