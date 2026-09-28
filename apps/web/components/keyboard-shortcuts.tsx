"use client";

import { formatForDisplay, useHotkey, useHotkeyRegistrations } from "@tanstack/react-hotkeys";
import { useId, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@domainstack/ui/dialog";
import { Kbd, KbdGroup } from "@domainstack/ui/kbd";
import { cn } from "@domainstack/ui/utils";

type ShortcutItem = {
  id: string;
  name: string;
  /** Anything `formatForDisplay` accepts, e.g. "Mod+K" or a lone "Shift". */
  hotkey: string;
  /** A pointer action that follows the keys, e.g. "click". */
  gesture?: string;
};

/** Known groups, in display order; unknown groups follow in registration order. */
const GROUP_ORDER = ["Global", "Dashboard", "Selection"];

/**
 * Pointer gestures can't be registered as hotkeys, so they are listed here and
 * shown only while their group has live registrations.
 */
const POINTER_SHORTCUTS: Array<ShortcutItem & { group: string }> = [
  {
    id: "dashboard-range-select",
    group: "Selection",
    name: "Select a range",
    hotkey: "Shift",
    gesture: "click",
  },
];

/** One keycap per key, as symbols on macOS (⌘ K) and labels elsewhere (Ctrl K). */
function ShortcutKeys({ hotkey, gesture }: Pick<ShortcutItem, "hotkey" | "gesture">) {
  const keys = formatForDisplay(hotkey, { parts: true });
  const spoken = formatForDisplay(hotkey, { parts: true, useSymbols: false }).join(" ");

  return (
    <KbdGroup className="shrink-0">
      <span className="sr-only">{gesture ? `${spoken} ${gesture}` : spoken}</span>
      {keys.map((key) => (
        <Kbd key={key} aria-hidden className="border bg-muted/80 px-1.5 tabular-nums">
          {key}
        </Kbd>
      ))}
      {gesture ? (
        <span aria-hidden className="text-xs text-muted-foreground">
          {gesture}
        </span>
      ) : null}
    </KbdGroup>
  );
}

function ShortcutSection({ title, items }: { title: string; items: ShortcutItem[] }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="mb-5 break-inside-avoid last:mb-0">
      <h3 id={headingId} className="mb-1 text-xs font-medium text-muted-foreground">
        {title}
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item.id} className="flex min-h-8 items-center justify-between gap-4 py-1">
            <span className="min-w-0 truncate text-sm">{item.name}</span>
            <ShortcutKeys hotkey={item.hotkey} gesture={item.gesture} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Reads the live hotkey registry, so every shortcut with `meta.name` shows up
 * while the component that registers it is mounted. Rendered only inside the
 * open dialog, because the registry also updates each time a hotkey fires.
 */
function ShortcutList() {
  const { hotkeys } = useHotkeyRegistrations();

  const groups = new Map<string, ShortcutItem[]>();
  const seen = new Set<string>();
  for (const registration of hotkeys) {
    const { meta } = registration.options;
    // The same hotkey can be registered more than once (e.g. header and home search).
    if (!meta?.name || seen.has(registration.hotkey)) continue;
    seen.add(registration.hotkey);

    const group = meta.group ?? "Global";
    const items = groups.get(group) ?? [];
    items.push({ id: registration.id, name: meta.name, hotkey: registration.hotkey });
    groups.set(group, items);
  }
  for (const { group, ...item } of POINTER_SHORTCUTS) {
    groups.get(group)?.push(item);
  }

  const rank = (group: string) => {
    const index = GROUP_ORDER.indexOf(group);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  const sections = [...groups].sort(([a], [b]) => rank(a) - rank(b));
  // A lone section (e.g. Global off the dashboard) stays one column in a narrow dialog.
  const multiColumn = sections.length > 1;

  return (
    <div
      // A tab stop so keyboard users can scroll a long list.
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      aria-label="Shortcuts"
      className="-mx-5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      {/* Columns sit inside the scroller: a height-capped multicol box would
          overflow sideways into extra columns instead of scrolling. The dialog
          widens to fit them via `data-multi-column`. */}
      <div
        data-multi-column={multiColumn || undefined}
        className={cn(multiColumn && "sm:columns-2 sm:gap-8")}
      >
        {sections.map(([title, items]) => (
          <ShortcutSection key={title} title={title} items={items} />
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useHotkey("?", () => setOpen(true), {
    ignoreInputs: true,
    requireReset: true,
    meta: {
      name: "Show keyboard shortcuts",
      description: "Open this list of shortcuts",
      group: "Global",
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Open onto the dialog itself. By default Base UI focuses the first tabbable
          element, the scrollable list, which would show its focus ring right away. */}
      <DialogContent
        ref={popupRef}
        initialFocus={popupRef}
        className="sm:max-w-md sm:has-data-multi-column:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Shortcuts available on this page
          </DialogDescription>
        </DialogHeader>
        <ShortcutList />
      </DialogContent>
    </Dialog>
  );
}
