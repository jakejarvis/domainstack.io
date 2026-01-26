import { IconActivity, IconPlug, IconWorld } from "@tabler/icons-react";
import { useMemo } from "react";
import { ProviderLogo } from "@/components/icons/provider-logo";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import type { AvailableProvidersByCategory } from "@/hooks/use-dashboard-filters";
import { HEALTH_OPTIONS } from "@/lib/constants/domain-filters";
import type { HealthFilter } from "@/lib/dashboard-utils";

type FilterDropdownsProps = {
  health: HealthFilter[];
  tlds: string[];
  providers: string[];
  availableTlds: string[];
  availableProviders: AvailableProvidersByCategory;
  onHealthChange: (values: HealthFilter[]) => void;
  onTldsChange: (values: string[]) => void;
  onProvidersChange: (values: string[]) => void;
};

export function FilterDropdowns({
  health,
  tlds,
  providers,
  availableTlds,
  availableProviders,
  onHealthChange,
  onTldsChange,
  onProvidersChange,
}: FilterDropdownsProps) {
  // Memoize TLD options to avoid re-allocating on every render
  // TLDs are stored without leading dot but displayed with dot
  // Include the dotted version as a keyword so search works with or without the dot
  const tldOptions = useMemo(
    () =>
      availableTlds.map((t) => ({
        value: t,
        label: `.${t}`,
        keywords: [`.${t}`], // Allow searching with the dot
      })),
    [availableTlds],
  );

  // Memoize provider sections for the multi-select
  const providerSections = useMemo(() => {
    const sections = [];

    if (availableProviders.registrar.length > 0) {
      sections.push({
        label: "Registrar",
        options: availableProviders.registrar.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    if (availableProviders.dns.length > 0) {
      sections.push({
        label: "DNS",
        options: availableProviders.dns.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    if (availableProviders.hosting.length > 0) {
      sections.push({
        label: "Hosting",
        options: availableProviders.hosting.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    if (availableProviders.email.length > 0) {
      sections.push({
        label: "Email",
        options: availableProviders.email.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    if (availableProviders.ca.length > 0) {
      sections.push({
        label: "CA",
        options: availableProviders.ca.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    return sections;
  }, [availableProviders]);

  return (
    <div className="flex flex-wrap gap-2">
      <MultiSelect
        label="Health"
        icon={IconActivity}
        options={HEALTH_OPTIONS}
        selected={health}
        onSelectionChange={onHealthChange}
        popoverWidth="w-40"
      />
      {availableTlds.length > 0 && (
        <MultiSelect
          label="TLD"
          icon={IconWorld}
          options={tldOptions}
          selected={tlds}
          onSelectionChange={onTldsChange}
          searchable
          popoverWidth="w-40"
        />
      )}
      {providerSections.length > 0 && (
        <MultiSelect
          label="Providers"
          icon={IconPlug}
          sections={providerSections}
          selected={providers}
          onSelectionChange={onProvidersChange}
          searchable
          renderOption={(
            option: MultiSelectOption<string> & {
              /** Optional domain for provider logo rendering */
              domain?: string | null;
              /** Optional provider ID for provider logo rendering */
              id?: string | null;
            },
          ) => (
            <div className="flex items-center gap-1.5 px-0.5 py-[3px]">
              <ProviderLogo
                providerId={option.id}
                providerName={option.label}
                className="size-3.5 shrink-0"
              />
              <span className="max-w-[240px] truncate leading-none">
                {option.label}
              </span>
            </div>
          )}
        />
      )}
    </div>
  );
}
