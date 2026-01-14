import type { Header } from "@/lib/types/domain/headers";

/**
 * Normalize header names (trim + lowercase).
 */
export function normalizeHeaders(h: Header[]): Header[] {
  return h.map((hdr) => ({
    name: hdr.name.trim().toLowerCase(),
    value: hdr.value,
  }));
}
