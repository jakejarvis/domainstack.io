"use client";

import { useLingui } from "@lingui/react";
import { IconWorld } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import { isLocale, LOCALE_COOKIE, LOCALE_LABELS, LOCALES } from "@domainstack/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Cookie-only locale switcher. Sets `ds_locale` then `router.refresh()` so the
 * server re-renders RSC (and `<html lang>` / metadata) in the chosen locale.
 */
export function LocaleSwitcher() {
  const { i18n } = useLingui();
  const router = useRouter();
  const current = isLocale(i18n.locale) ? i18n.locale : "en";

  return (
    <label className="inline-flex cursor-pointer items-center gap-1 text-foreground/85 hover:text-foreground/60">
      <IconWorld className="size-4 px-[1px] text-muted-foreground" />
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={current}
        onChange={(event) => {
          const next = event.target.value;
          if (!isLocale(next) || next === current) return;
          document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
          router.refresh();
        }}
        className="cursor-pointer rounded-sm bg-background text-foreground/85 outline-none hover:text-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
