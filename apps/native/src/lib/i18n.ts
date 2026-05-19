import * as Localization from "expo-localization";

import { DEFAULT_LOCALE, isLocale, loadCatalog, type Locale } from "@domainstack/i18n";

/** The device's preferred language if we support it, else the default. */
export function deviceLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageCode;
  return isLocale(tag) ? tag : DEFAULT_LOCALE;
}

export { loadCatalog };
export type { Locale };
