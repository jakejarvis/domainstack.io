import { IMPORTANT_HEADERS } from "@/lib/constants/headers";
import type { Header } from "@/lib/types/domain/headers";

/**
 * Normalize header names (trim + lowercase) then sort important headers first.
 */
export function normalizeHeaders(h: Header[]): Header[] {
  const normalized = h.map((hdr) => ({
    name: hdr.name.trim().toLowerCase(),
    value: hdr.value,
  }));
  return normalized.sort(
    (a, b) =>
      Number(IMPORTANT_HEADERS.has(b.name)) -
        Number(IMPORTANT_HEADERS.has(a.name)) || a.name.localeCompare(b.name),
  );
}
