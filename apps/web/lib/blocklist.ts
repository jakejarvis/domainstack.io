/**
 * Parse a domain blocklist (one entry per line) into lowercased domain names.
 *
 * Accepts OISD's wildcard format (`*.example.com` or `example.com`). Skips blank
 * lines, `#` comments, entries shorter than 3 or longer than 253 characters,
 * entries with a leading or trailing dot, entries without an inner dot, and
 * entries with inner whitespace. Surrounding whitespace and `\r` are trimmed.
 *
 * Written as a single character scan because lists run to hundreds of thousands
 * of lines.
 */
export function parseBlocklist(text: string): string[] {
  const domains: string[] = [];
  let start = 0;
  const len = text.length;

  while (start < len) {
    let end = text.indexOf("\n", start);
    if (end === -1) end = len;

    let tStart = start;
    let tEnd = end - 1;

    // Fast trim spaces and carriage returns
    while (tStart <= tEnd && text.charCodeAt(tStart) <= 32) tStart++;
    while (tEnd >= tStart && text.charCodeAt(tEnd) <= 32) tEnd--;

    start = end + 1;

    if (tStart > tEnd || text.charCodeAt(tStart) === 35) continue; // Empty line or '#' comment

    // Remove "*." prefix
    if (
      tEnd - tStart >= 1 &&
      text.charCodeAt(tStart) === 42 &&
      text.charCodeAt(tStart + 1) === 46
    ) {
      tStart += 2;
    }

    const dLen = tEnd - tStart + 1;
    // Length check and check for leading/trailing dot
    if (dLen > 253 || dLen < 3 || text.charCodeAt(tStart) === 46 || text.charCodeAt(tEnd) === 46) {
      continue;
    }

    let hasDot = false;
    let valid = true;
    for (let i = tStart + 1; i < tEnd; i++) {
      const c = text.charCodeAt(i);
      if (c === 46) hasDot = true;
      else if (c <= 32) {
        valid = false;
        break;
      }
    }

    if (valid && hasDot) {
      domains.push(text.slice(tStart, tEnd + 1).toLowerCase());
    }
  }

  return domains;
}
