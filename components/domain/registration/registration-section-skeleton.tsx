import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { Section } from "@/components/domain/section";
import { sections } from "@/lib/sections-meta";

export function RegistrationSectionSkeleton() {
  return (
    <Section {...sections.registration} isLoading>
      <KeyValueGrid colsDesktop={2}>
        <KeyValueSkeleton label="Registrar" withLeading withSuffix />
        <KeyValueSkeleton label="Registrant" />
        <KeyValueSkeleton label="Created" />
        <KeyValueSkeleton label="Expires" withSuffix />
      </KeyValueGrid>
    </Section>
  );
}
