/**
 * Macro-free, dependency-free i18n constants and helpers.
 *
 * This module must stay importable from the Next.js middleware / Edge runtime,
 * so it MUST NOT import `@lingui/*` or anything Node-only.
 */

export const LOCALES = ["en", "es", "fr", "de"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that persists the visitor's chosen locale on web. */
export const LOCALE_COOKIE = "ds_locale";

/** Human-readable, self-localized language names for a locale switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

/**
 * Pick the best supported locale from an `Accept-Language` header value.
 * Falls back to {@link DEFAULT_LOCALE} when nothing matches.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  for (const part of acceptLanguage.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }

  return DEFAULT_LOCALE;
}
