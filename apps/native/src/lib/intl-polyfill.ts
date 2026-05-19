/**
 * Intl polyfills for Hermes (React Native).
 *
 * Load order matters — each polyfill depends on the ones before it.
 * See: https://formatjs.github.io/docs/guides/react-native-hermes
 *
 * We use `polyfill` (not `polyfill-force`) so Hermes's native Intl
 * implementations are preserved when available, and only gaps are filled.
 */

// 1. getCanonicalLocales (no dependencies)
import "@formatjs/intl-getcanonicallocales/polyfill.js";
// 2. Locale (depends on getCanonicalLocales)
import "@formatjs/intl-locale/polyfill.js";
// 3. PluralRules (depends on Locale)
import "@formatjs/intl-pluralrules/polyfill.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/fr.js";
import "@formatjs/intl-pluralrules/locale-data/de.js";
import "@formatjs/intl-pluralrules/locale-data/es.js";
// 4. NumberFormat (depends on PluralRules, Locale)
import "@formatjs/intl-numberformat/polyfill.js";
import "@formatjs/intl-numberformat/locale-data/en.js";
import "@formatjs/intl-numberformat/locale-data/fr.js";
import "@formatjs/intl-numberformat/locale-data/de.js";
import "@formatjs/intl-numberformat/locale-data/es.js";
// 5. DateTimeFormat (depends on Locale)
import "@formatjs/intl-datetimeformat/polyfill.js";
import "@formatjs/intl-datetimeformat/locale-data/en.js";
import "@formatjs/intl-datetimeformat/locale-data/fr.js";
import "@formatjs/intl-datetimeformat/locale-data/de.js";
import "@formatjs/intl-datetimeformat/locale-data/es.js";
import "@formatjs/intl-datetimeformat/add-all-tz.js";
// 6. RelativeTimeFormat (depends on PluralRules, Locale)
import "@formatjs/intl-relativetimeformat/polyfill.js";
import "@formatjs/intl-relativetimeformat/locale-data/en.js";
import "@formatjs/intl-relativetimeformat/locale-data/fr.js";
import "@formatjs/intl-relativetimeformat/locale-data/de.js";
import "@formatjs/intl-relativetimeformat/locale-data/es.js";
