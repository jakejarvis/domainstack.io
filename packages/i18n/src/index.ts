import { type I18n, type Messages, i18n } from "@lingui/core";

import { DEFAULT_LOCALE, type Locale } from "./config";

export * from "./config";
export { i18n };
export type { I18n, Messages };

/**
 * Static per-locale loaders. An explicit map (rather than a templated dynamic
 * `import()`) keeps catalog code-splitting robust across every bundler we
 * target — Next.js (Turbopack/webpack) and Metro — and across `tsc`.
 */
const CATALOG_LOADERS: Record<Locale, () => Promise<{ messages: Messages }>> = {
  en: () => import("./locales/en/messages"),
  es: () => import("./locales/es/messages"),
  fr: () => import("./locales/fr/messages"),
  de: () => import("./locales/de/messages"),
};

/** Load (without activating) the compiled catalog for a locale. */
export async function getMessages(locale: Locale): Promise<Messages> {
  const { messages } = await CATALOG_LOADERS[locale]();
  return messages;
}

/**
 * Load + activate a locale on the shared client/native singleton.
 * Use this on the client and in the native app (one user per process).
 * Do NOT use the singleton on the web server — see web `lib/i18n-server.ts`.
 */
export async function loadCatalog(locale: Locale): Promise<void> {
  const messages = await getMessages(locale);
  i18n.load(locale, messages);
  i18n.activate(locale);
}

export async function initI18n(locale: Locale = DEFAULT_LOCALE): Promise<I18n> {
  await loadCatalog(locale);
  return i18n;
}
