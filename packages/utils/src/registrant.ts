import type { RegistrationContact } from "@domainstack/types";

/**
 * Interpret registrant contacts for display.
 *
 * Client-safe: this only reads what rdapper already decided (`redacted`,
 * `redactedFields`, `privacyService`) and never imports rdapper itself. Stored
 * contacts from older rdapper versions are brought up to date server-side by
 * `upgradeContacts` (`@domainstack/utils/contacts`) before they reach the client.
 *
 * Registries can also return NIC handles (e.g. `JJ1234-IS`) in place of a name,
 * which rdapper doesn't resolve yet, so that one check lives here.
 */

export type RegistrantState =
  /** A usable name or organization is available. */
  | "named"
  /** Identity is redacted by the registry/registrar. */
  | "redacted"
  /** No identity, but a location (state/country) is published. */
  | "location-only"
  /** Registrant contact exists but nothing usable is published. */
  | "empty";

export type RegistrantView = {
  state: RegistrantState;
  /** Primary line: name/organization, when known. */
  name?: string;
  /** Secondary line: "State, Country". */
  location?: string;
};

// NIC handles, e.g. "JJ1234-IS", "ABC123-RIPE", "AB1-NORID", "C12345678". Handles
// without digits are only recognized with a known registry suffix, so all-caps
// names like "ACME-CORP" survive.
const NIC_HANDLE =
  /^(?:[A-Z]{1,6}\d{1,10}-[A-Z]{2,8}|[A-Z0-9]{2,10}-(?:IS|RIPE|APNIC|AP|ARIN|NORID|SE|NL|DK|FI)|[A-Z]{1,3}\d{5,})$/;

function isHandle(value: string): boolean {
  return NIC_HANDLE.test(value.trim());
}

/** A value that can be shown to a human as a name/organization. */
function usableName(value: string | undefined | null): string | undefined {
  const v = value?.trim();
  if (!v || isHandle(v)) return undefined;
  return v;
}

function formatCountry(country?: string, countryCode?: string): string | undefined {
  const raw = (country || countryCode || "").trim();
  if (!raw) return undefined;
  if (/^[A-Za-z]{2}$/.test(raw)) {
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(raw.toUpperCase());
      if (name && name !== raw.toUpperCase()) return name;
    } catch {
      // fall through to raw code
    }
    return raw.toUpperCase();
  }
  return raw;
}

function formatLocation(c: RegistrationContact): string | undefined {
  const country = formatCountry(c.country, c.countryCode);
  const state = c.state?.trim();
  const parts = [state || undefined, country].filter((p): p is string => Boolean(p));
  const unique = parts.filter(
    (p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i,
  );
  return unique.length > 0 ? unique.join(", ") : undefined;
}

export function describeRegistrant(
  contacts: RegistrationContact[] | null | undefined,
  privacyEnabled?: boolean | null,
): RegistrantView | null {
  const registrant = contacts?.find((c) => c.type === "registrant");
  if (!registrant) return null;

  // A proxy service's name is not the registrant's.
  const name = registrant.privacyService
    ? undefined
    : (usableName(registrant.organization) ?? usableName(registrant.name));
  const location = formatLocation(registrant);

  // Identity is withheld or belongs to a privacy service. Mirrors rdapper's
  // `isPrivacyContact`; a bare `redacted` flag with no field list counts too,
  // since we can't tell what was hidden.
  const redactedFields = registrant.redactedFields ?? [];
  const identityRedacted =
    Boolean(registrant.privacyService) ||
    (redactedFields.length > 0
      ? redactedFields.some((f) => f === "name" || f === "organization")
      : Boolean(registrant.redacted));

  // `privacyEnabled` is coarse: rdapper sets it for any redacted registrant field
  // (an email-only redaction is the usual GDPR shape). Identity is only hidden
  // when no usable name survived, so a visible name stays a named registrant, and
  // a redacted country or email on its own doesn't hide anything.
  const redacted = !name && (Boolean(privacyEnabled) || identityRedacted);

  // Redaction wins even when a stray country is published.
  const state: RegistrantState = redacted
    ? "redacted"
    : name
      ? "named"
      : location
        ? "location-only"
        : "empty";

  return { state, name: redacted ? undefined : name, location };
}
