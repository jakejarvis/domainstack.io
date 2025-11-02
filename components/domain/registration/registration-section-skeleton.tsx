import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { Section } from "@/components/domain/section";
import { sections } from "@/lib/sections-meta";

export function RegistrationSectionSkeleton() {
  return (
    <Section {...sections.registration} isLoading>
      <KeyValueGrid colsDesktop={2}>
        <KeyValueSkeleton
          label="Registrar"
          withLeading
          widthClass="w-[120px]"
        />
        <KeyValueSkeleton label="Registrant" widthClass="w-[100px]" />
        <KeyValueSkeleton label="Created" widthClass="w-[120px]" />
        <KeyValueSkeleton label="Expires" widthClass="w-[120px]" />
      </KeyValueGrid>
    </Section>
  );
}
