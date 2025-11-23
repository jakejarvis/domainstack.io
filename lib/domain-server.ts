import { toRegistrableDomain as toRegistrableDomainRdapper } from "rdapper";
import { cache } from "react";
import { BLACKLISTED_SUFFIXES } from "@/lib/constants/domain-validation";

// A simple wrapper around rdapper's toRegistrableDomain that:
// 1. is cached for per-request deduplication
// 2. checks if the domain is blacklisted by BLACKLISTED_SUFFIXES in constants/domain-validation.ts
export const toRegistrableDomain = cache(function toRegistrableDomain(
  input: string,
): string | null {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "") return null;

  // Shortcut: exact suffixes such as ".css.map" that frequently appear
  for (const suffix of BLACKLISTED_SUFFIXES) {
    if (value.endsWith(suffix)) return null;
  }

  return toRegistrableDomainRdapper(value);
});
