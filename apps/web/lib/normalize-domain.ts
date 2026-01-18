import { toRegistrableDomain as toRegistrableDomainRdapper } from "rdapper";
import { cache } from "react";
import { BLACKLISTED_SUFFIXES } from "@/lib/constants/domain-validation";
import { normalizeDomainInput } from "@/lib/domain-utils";

// A wrapper around rdapper's toRegistrableDomain that:
// 1. normalizes user input (strips schemes, paths, ports, auth, www., etc.)
// 2. is cached for per-request deduplication
// 3. checks if the domain is blacklisted by BLACKLISTED_SUFFIXES in constants/domain-validation.ts
export const toRegistrableDomain = cache(function toRegistrableDomain(
  input: string,
): string | null {
  // First normalize the input to extract a clean hostname
  // This handles user input with schemes, paths, ports, auth, trailing dots, www., etc.
  const normalized = normalizeDomainInput(input);
  if (!normalized) return null;

  const value = normalized.trim().toLowerCase();
  if (value === "") return null;

  // Shortcut: exact suffixes such as ".css.map" that frequently appear
  for (const suffix of BLACKLISTED_SUFFIXES) {
    if (value.endsWith(suffix)) return null;
  }

  return toRegistrableDomainRdapper(value);
});
