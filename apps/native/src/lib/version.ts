/**
 * Parse a version string like "1.4.2" or "1.4.0-rc.1" into a numeric tuple.
 * Trailing prerelease tags are stripped — `isVersionBelow` treats them as the
 * base version, which is fine for a coarse min-version gate.
 */
function parseVersion(value: string): [number, number, number] | null {
  const base = value.split(/[-+]/, 1)[0];
  const parts = base.split(".");
  if (parts.length === 0) return null;
  const tuple: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const segment = parts[i];
    if (segment === undefined) continue;
    const n = Number.parseInt(segment, 10);
    if (!Number.isFinite(n) || n < 0 || String(n) !== segment) return null;
    tuple[i] = n;
  }
  return tuple;
}

/**
 * Returns true when `current` is strictly below `required`. Either argument
 * being unparseable yields `false` (fail open — never lock the user out
 * because of bad version metadata).
 */
export function isVersionBelow(current: string, required: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(required);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}
