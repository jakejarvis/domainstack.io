import { IconSearch, IconX } from "@tabler/icons-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@domainstack/ui/input-group";

type FilterSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function FilterSearchInput({ value, onChange }: FilterSearchInputProps) {
  return (
    <div className="flex-1 lg:max-w-xs">
      <InputGroup>
        <InputGroupAddon>
          <IconSearch />
        </InputGroupAddon>
        <InputGroupInput
          name="domain-search"
          placeholder="Search domains…"
          aria-label="Search domains"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Escape" || e.nativeEvent.isComposing) return;
            // Clear the query first, then leave the field. Stopping propagation keeps
            // the dashboard's Escape hotkey from also clearing the selection.
            e.preventDefault();
            e.stopPropagation();
            if (value) onChange("");
            else e.currentTarget.blur();
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        {value && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              onClick={() => onChange("")}
              aria-label="Clear search"
              className="animate-in duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] fade-in-0 zoom-in-98 motion-reduce:animate-none"
            >
              <IconX />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}
