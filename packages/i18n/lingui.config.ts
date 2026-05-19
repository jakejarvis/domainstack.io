import { defineConfig } from "@lingui/cli";
import type { LinguiConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";

/**
 * Single shared Lingui catalog for the whole monorepo.
 *
 * `<rootDir>` resolves to this package directory (`packages/i18n`). The
 * extractor scans the web app, the native app, and the shared web UI package,
 * writing one `.po` per locale here so web + native share a single source of
 * truth. Compiled `.ts` siblings are produced by `lingui compile --typescript`
 * and committed so `check-types`/CI never need the Wasm CLI mid-build.
 */
const config: LinguiConfig = defineConfig({
  sourceLocale: "en",
  locales: ["en", "es", "fr", "de"],
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: [
        "<rootDir>/../../apps/web/app",
        "<rootDir>/../../apps/web/components",
        "<rootDir>/../../apps/native/src",
        "<rootDir>/../../packages/ui/src",
      ],
      // NOTE: exclude globs are ABSOLUTE (via <rootDir>). Lingui v6 feeds these
      // to Node's `fs.globSync({ exclude })`, and against the absolute include
      // globs only absolute exclude patterns actually match (relative ones are
      // silently ignored on Node 24). Vitest browser snapshots are DIRECTORIES
      // named `*.test.tsx`, so without this the extractor `read()`s a directory
      // and dies with EISDIR.
      exclude: [
        "<rootDir>/../../**/node_modules/**",
        "<rootDir>/../../**/.next/**",
        "<rootDir>/../../**/.expo/**",
        "<rootDir>/../../**/__screenshots__/**",
        "<rootDir>/../../**/*.test.ts",
        "<rootDir>/../../**/*.test.tsx",
      ],
    },
  ],
  format: formatter({ origins: true, lineNumbers: false }),
});

export default config;
