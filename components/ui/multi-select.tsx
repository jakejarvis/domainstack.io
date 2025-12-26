"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type MultiSelectOption<T extends string> = {
  value: T;
  label: string;
  /** Optional search keywords to match against (in addition to value and label) */
  keywords?: string[];
};

export type MultiSelectSection<T extends string> = {
  label: string;
  options: MultiSelectOption<T>[];
};

export type MultiSelectProps<T extends string> = {
  /** Label displayed on the trigger button */
  label: string;
  /** Icon displayed before the label */
  icon: LucideIcon;
  /** Available options to select from (flat list) */
  options?: MultiSelectOption<T>[];
  /** Available options grouped into sections (mutually exclusive with options) */
  sections?: MultiSelectSection<T>[];
  /** Currently selected values */
  selected: T[];
  /** Callback when selection changes */
  onSelectionChange: (values: T[]) => void;
  /** Custom option renderer (receives option and returns content) */
  renderOption?: (option: MultiSelectOption<T>) => React.ReactNode;
  /** Whether to show a search input (default: false) */
  searchable?: boolean;
  /** Custom class name for the trigger button */
  className?: string;
  /** Width of the popover content (default: "w-48") */
  popoverWidth?: string;
};

/**
 * A multi-select dropdown component using Base UI ComboboxPrimitive.
 * Supports optional search, sections, custom rendering, and displays a selection count badge.
 */
export function MultiSelect<T extends string>({
  label,
  icon: Icon,
  options,
  sections,
  selected,
  onSelectionChange,
  renderOption,
  searchable = false,
  className,
  popoverWidth = "w-48",
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when the popover opens to avoid scroll jumping
  // caused by autoFocus attempting to scroll the element into view
  // before it is properly positioned.
  useEffect(() => {
    if (open && searchable && inputRef.current) {
      // Small timeout to ensure positioning is stable
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, searchable]);

  const { contains } = ComboboxPrimitive.useFilter({
    multiple: true,
  });

  const flatOptions = useMemo(() => {
    return sections
      ? sections.flatMap((section) => section.options)
      : (options ?? []);
  }, [options, sections]);

  const optionByValue = useMemo(() => {
    return new Map(flatOptions.map((opt) => [opt.value, opt]));
  }, [flatOptions]);

  const selectedItems = selected
    .map((v) => optionByValue.get(v))
    .filter(Boolean) as Array<MultiSelectOption<T>>;

  // Default option renderer
  const defaultRenderOption = (option: MultiSelectOption<T>) => option.label;
  const optionRenderer = renderOption ?? defaultRenderOption;

  const filterOption = (option: MultiSelectOption<T>, query: string) => {
    const q = query.trim();
    if (q === "") return true;

    // Match label/value/keywords using Base UI's locale-aware matcher.
    if (contains(option.label, q)) return true;
    if (contains(option.value, q)) return true;
    return (option.keywords ?? []).some((keyword) => contains(keyword, q));
  };

  const itemClassName = cn(
    "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    // `data-highlighted` matches the highlighted/active item state.
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
  );

  return (
    <ComboboxPrimitive.Root
      items={
        sections
          ? sections.map((section) => ({
              value: section.label,
              items: section.options,
            }))
          : (options ?? [])
      }
      multiple
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        // Preserve previous behavior: selecting items should not close the popup.
        if (
          !nextOpen &&
          // Base UI uses reason strings like "item-press" in its change event details.
          (eventDetails as { reason?: string } | undefined)?.reason ===
            "item-press"
        ) {
          return;
        }

        setOpen(nextOpen);
        if (!nextOpen) {
          setInputValue("");
        }
      }}
      value={selectedItems}
      onValueChange={(next, _eventDetails) => {
        const nextArray = Array.isArray(next) ? next : next ? [next] : [];
        onSelectionChange(nextArray.map((opt) => opt.value));
      }}
      // Keep the search query stable when selecting items.
      inputValue={searchable ? inputValue : undefined}
      onInputValueChange={
        searchable
          ? (nextSearch, { reason }) => {
              if (reason === "item-press") {
                return;
              }
              setInputValue(nextSearch);
            }
          : undefined
      }
      filter={searchable ? filterOption : null}
    >
      <ComboboxPrimitive.Trigger
        render={
          <Button
            variant="outline"
            className={cn(
              "h-9 gap-2 px-3",
              selected.length > 0 &&
                "border-foreground/20 bg-primary/3 dark:border-foreground/15 dark:bg-primary/10",
              className,
            )}
          >
            <Icon className="size-4 opacity-60" />
            {label}
            {selected.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-foreground/10 px-1.5 font-semibold text-xs tabular-nums dark:bg-foreground/20">
                {selected.length}
              </span>
            )}
            <ChevronDown className="size-4 opacity-50" />
          </Button>
        }
      />

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner align="start" sideOffset={4}>
          <ComboboxPrimitive.Popup
            className={cn(
              // Mirror `PopoverContent` base styling (but keep padding controlled by inner content).
              "z-50 w-72 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-hidden",
              "origin-[var(--transform-origin)] will-change-[transform,opacity]",
              "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[starting-style]:scale-95",
              // Animation classes
              "data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-open:animate-in",
              popoverWidth,
            )}
          >
            {/* Mirror `Command` wrapper styling */}
            <div
              data-slot="command"
              className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground"
            >
              {searchable && (
                <div
                  data-slot="command-input-wrapper"
                  className="flex h-9 items-center gap-2 border-b px-3"
                >
                  <SearchIcon className="size-4 shrink-0 opacity-50" />
                  <ComboboxPrimitive.Input
                    ref={inputRef}
                    placeholder={`Search ${label}...`}
                    className={cn(
                      "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
              )}

              <ComboboxPrimitive.Empty
                data-slot="command-empty"
                // Base UI keeps the element mounted; when `children` becomes `null`, padding would still reserve space.
                // `empty:hidden` ensures this doesn't create a blank region at the top of the list.
                className="py-6 text-center text-sm empty:hidden"
              >
                No results found.
              </ComboboxPrimitive.Empty>

              {sections ? (
                <ScrollArea
                  className="max-h-[300px]"
                  gradient
                  gradientContext="popover"
                >
                  <ComboboxPrimitive.List
                    data-slot="command-list"
                    className="scroll-py-1"
                  >
                    {(group: {
                      value: string;
                      items: Array<MultiSelectOption<T>>;
                    }) => (
                      <ComboboxPrimitive.Group
                        key={group.value}
                        items={group.items}
                        data-slot="command-group"
                        className="overflow-hidden p-1 text-foreground"
                      >
                        <ComboboxPrimitive.GroupLabel className="select-none px-2 py-1.5 font-medium text-muted-foreground text-xs">
                          {group.value}
                        </ComboboxPrimitive.GroupLabel>
                        <ComboboxPrimitive.Collection>
                          {(option: MultiSelectOption<T>) => {
                            const isSelected = selected.includes(option.value);
                            return (
                              <ComboboxPrimitive.Item
                                key={option.value}
                                value={option}
                                className={itemClassName}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  className="pointer-events-none"
                                />
                                {optionRenderer(option)}
                              </ComboboxPrimitive.Item>
                            );
                          }}
                        </ComboboxPrimitive.Collection>
                      </ComboboxPrimitive.Group>
                    )}
                  </ComboboxPrimitive.List>
                </ScrollArea>
              ) : (
                <ScrollArea
                  className="max-h-[300px]"
                  gradient
                  gradientContext="popover"
                >
                  <ComboboxPrimitive.List
                    data-slot="command-list"
                    className="scroll-py-1 p-1 text-foreground"
                  >
                    {(option: MultiSelectOption<T>) => {
                      const isSelected = selected.includes(option.value);
                      return (
                        <ComboboxPrimitive.Item
                          key={option.value}
                          value={option}
                          className={itemClassName}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="pointer-events-none"
                          />
                          {optionRenderer(option)}
                        </ComboboxPrimitive.Item>
                      );
                    }}
                  </ComboboxPrimitive.List>
                </ScrollArea>
              )}
            </div>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
