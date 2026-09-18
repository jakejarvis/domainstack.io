# Catalog seed data

These files are **not read at runtime**. The live catalogs are Vercel Edge Config keys:
`provider_catalog` and `technology_catalog`.

They exist for two reasons: they are the reviewable, diffable source of what was uploaded, and the
package's tests validate and time-budget them as real data.

To change the live technology catalog: edit `technology-catalog.json`, get the test suite green,
then paste the file's contents into the `technology_catalog` key in the Vercel Edge Config
dashboard. Nothing verifies that this file and Edge Config agree — keep them in sync by hand.

## Licensing

Every entry is written from the public documentation and observable output of the product it
detects. Nothing here may be copied or adapted from Wappalyzer or any of its forks: those datasets
are GPL-3.0 and this repository is MIT.

## Authoring rules

- Prefer a signal the vendor controls and documents (a branded response header, a vendor CDN
  hostname) over a generic one. A rule that can fire on an unrelated site is worse than no rule.
- Put the version-capturing pattern FIRST inside an `any`: `any` short-circuits, and only the first
  matching branch contributes a version.
- Keep patterns anchored and free of nested quantifiers. They run against HTML bodies up to 512 KB;
  see the timing budget in `src/technologies/seed.test.ts`.
- `slug` is a stable key. Once shipped it is stored in the database and must never be renamed.
