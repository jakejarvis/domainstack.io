import type { LucideIcon } from "lucide-react";
import { ProviderIcon } from "@/components/icons/provider-icon";
import {
  MultiSelect,
  type MultiSelectOption,
  type MultiSelectSection,
} from "@/components/ui/multi-select";

export type ProviderOption<T extends string> = MultiSelectOption<T> & {
  /** Optional domain for provider logo rendering */
  domain?: string | null;
  /** Optional provider ID for provider logo rendering */
  id?: string | null;
};

export type ProviderSection<T extends string> = {
  label: string;
  options: ProviderOption<T>[];
};

export type ProviderMultiSelectProps<T extends string> = {
  /** Label displayed on the trigger button */
  label: string;
  /** Icon displayed before the label */
  icon: LucideIcon;
  /** Available options to select from (flat list) */
  options?: ProviderOption<T>[];
  /** Available options grouped into sections (mutually exclusive with options) */
  sections?: ProviderSection<T>[];
  /** Currently selected values */
  selected: T[];
  /** Callback when selection changes */
  onSelectionChange: (values: T[]) => void;
  /** Whether to show a search input (default: false) */
  searchable?: boolean;
  /** Custom class name for the trigger button */
  className?: string;
  /** Optional Tailwind width class for the popover (auto-sizes to content if not set) */
  popoverWidth?: string;
};

/**
 * A specialized multi-select dropdown for providers.
 * Renders provider logos alongside option labels.
 */
export function ProviderMultiSelect<T extends string>({
  label,
  icon,
  options,
  sections,
  selected,
  onSelectionChange,
  searchable,
  className,
  popoverWidth,
}: ProviderMultiSelectProps<T>) {
  // Cast provider options back to base MultiSelectOption for the generic component
  const baseOptions = options as MultiSelectOption<T>[] | undefined;
  const baseSections = sections as MultiSelectSection<T>[] | undefined;

  return (
    <MultiSelect
      label={label}
      icon={icon}
      options={baseOptions}
      sections={baseSections}
      selected={selected}
      onSelectionChange={onSelectionChange}
      searchable={searchable}
      className={className}
      popoverWidth={popoverWidth}
      renderOption={(option) => {
        // Access provider-specific fields via type casting
        const providerOption = option as ProviderOption<T>;

        return (
          <>
            <ProviderIcon
              providerId={providerOption.id}
              providerName={providerOption.label}
              providerDomain={providerOption.domain}
              size={14}
              className="shrink-0 rounded"
            />
            {providerOption.label}
          </>
        );
      }}
    />
  );
}
