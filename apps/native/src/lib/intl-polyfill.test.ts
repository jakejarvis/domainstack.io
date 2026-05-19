import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { LOCALES } from "@domainstack/i18n";

// Guard: every locale we ship (`@domainstack/i18n` `LOCALES`) MUST have its
// FormatJS locale-data imported in the native polyfill, or that locale's
// numbers/dates/plurals/relative-times silently fall back to root/`en` data on
// Hermes. This is a coverage check, not an equality check — the polyfill may
// intentionally preload extra locales beyond `LOCALES`.
const POLYFILL_SOURCE = readFileSync(
  fileURLToPath(new URL("./intl-polyfill.ts", import.meta.url)),
  "utf8",
);

const FORMATTERS = [
  "intl-pluralrules",
  "intl-numberformat",
  "intl-datetimeformat",
  "intl-relativetimeformat",
] as const;

describe("native Intl polyfill locale-data coverage", () => {
  it.each(FORMATTERS)("imports %s locale-data for every supported locale", (formatter) => {
    for (const locale of LOCALES) {
      expect(
        POLYFILL_SOURCE,
        `Missing "@formatjs/${formatter}/locale-data/${locale}.js" — add it to intl-polyfill.ts`,
      ).toContain(`@formatjs/${formatter}/locale-data/${locale}.js`);
    }
  });
});
