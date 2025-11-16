import { toRegistrableDomain as toRegistrableDomainRdapper } from "rdapper";
import { BLACKLISTED_SUFFIXES } from "@/lib/constants/domain-validation";

// A simple wrapper around rdapper's toRegistrableDomain that also checks if
// the domain is blacklisted below
export function toRegistrableDomain(input: string): string | null {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "") return null;

  // Shortcut: exact suffixes such as ".css.map" that frequently appear
  for (const suffix of BLACKLISTED_SUFFIXES) {
    if (value.endsWith(suffix)) return null;
  }

  return toRegistrableDomainRdapper(value);
}
