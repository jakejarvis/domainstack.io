"use client";

import { formatForDisplay, useHotkey, useHotkeyRegistrations } from "@tanstack/react-hotkeys";
import { useId, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@domainstack/ui/dialog";
import { Kbd, KbdGroup } from "@domainstack/ui/kbd";

type ShortcutItem = {
  id: string;
  name: string;
  description?: string;
  keys: string[];
};

/**
 * Pointer gestures can't be registered as hotkeys, so they are listed here and
 * shown only while their group has live registrations.
 */
const POINTER_SHORTCUTS: Array<ShortcutItem & { group: string }> = [
  {
    id: "dashboard-range-select",
    group: "Dashboard",
    name: "Select a range",
    description: "Select or deselect through the clicked domain",
    keys: ["Shift", "Click"],
  },
];

function ShortcutSection({ title, items }: { title: string; items: ShortcutItem[] }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h2>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.name}</p>
              {item.description ? (
                <p className="text-[13px] text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <KbdGroup className="shrink-0">
              {item.keys.map((key, index) => (
                <span key={key} className="contents">
                  {index > 0 ? (
                    <span aria-hidden className="text-xs text-muted-foreground">
                      +
                    </span>
                  ) : null}
                  <Kbd>{key}</Kbd>
                </span>
              ))}
            </KbdGroup>
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
    items.push({
      id: registration.id,
      name: meta.name,
      description: meta.description,
      keys: [formatForDisplay(registration.hotkey)],
    });
    groups.set(group, items);
  }
  for (const { group, ...item } of POINTER_SHORTCUTS) {
    groups.get(group)?.push(item);
  }

  // Global first; page-specific groups follow in registration order.
  const sections = [...groups].sort(([a], [b]) => Number(b === "Global") - Number(a === "Global"));

  return (
    <div className="space-y-4">
      {sections.map(([title, items]) => (
        <ShortcutSection key={title} title={title} items={items} />
      ))}
    </div>
  );
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-0.5">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts available on this page for advanced users.
          </DialogDescription>
        </DialogHeader>
        <ShortcutList />
      </DialogContent>
    </Dialog>
  );
}
