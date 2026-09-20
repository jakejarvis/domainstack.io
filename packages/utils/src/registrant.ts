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

export type ContactDetails = {
  type: RegistrationContact["type"];
  name?: string;
  organization?: string;
  organizationUnits: string[];
  kind?: RegistrationContact["kind"];
  title?: string;
  role?: string;
  address: string[];
  location?: string;
  email: string[];
  phone: string[];
  fax: string[];
  /**
   * The registrant's identity (name/organization) was withheld or belongs to a
   * privacy service. Mirrors rdapper's `isPrivacyContact`; a bare `redacted` flag
   * with no field list counts too, since we can't tell what was hidden.
   */
  identityRedacted: boolean;
  /** Fields the registry withheld, as reported by rdapper. */
  redactedFields: NonNullable<RegistrationContact["redactedFields"]>;
  /** Name/organization belongs to a privacy or proxy service. */
  privacyService: boolean;
  /** Anything to show beyond the row's summary (name and location). */
  hasMore: boolean;
};

export type RegistrantView = {
  state: RegistrantState;
  /** Primary line: name/organization, when known. */
  name?: string;
  /** Secondary line: "State, Country". */
  location?: string;
  registrant?: ContactDetails;
  /** Non-registrant contacts that have something worth showing. */
  others: ContactDetails[];
  /** True when a details popover would add information beyond the summary row. */
  hasDetails: boolean;
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

function toList(value: string | string[] | undefined): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map((v) => v.trim()).filter(Boolean);
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

function describeContact(c: RegistrationContact): ContactDetails {
  // A proxy service's name is not the registrant's.
  const privacyService = Boolean(c.privacyService);
  const name = privacyService ? undefined : usableName(c.name);
  const organization = privacyService ? undefined : usableName(c.organization);
  const street = (c.street ?? []).map((s) => s.trim()).filter(Boolean);
  const cityLine = [c.city, c.state, c.postalCode]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  const country = formatCountry(c.country, c.countryCode);
  const poBox = c.poBox?.trim();
  const city = c.city?.trim();
  const postalCode = c.postalCode?.trim();
  const address = [
    ...(poBox ? [`PO Box ${poBox.replace(/^p\.?o\.?\s*box\s*/i, "")}`] : []),
    ...street,
    cityLine.join(", "),
    country ?? "",
  ].filter(Boolean);

  const organizationUnits = (c.organizationUnits ?? []).map((u) => u.trim()).filter(Boolean);
  const title = c.title?.trim() || undefined;
  const role = c.role?.trim() || undefined;
  const email = toList(c.email);
  const phone = toList(c.phone);
  const fax = toList(c.fax);
  const distinctOrganization = organization && organization !== name ? organization : undefined;
  const redactedFields = c.redactedFields ?? [];

  return {
    type: c.type,
    name,
    organization: distinctOrganization,
    organizationUnits,
    kind: c.kind,
    title,
    role,
    address,
    location: formatLocation(c),
    email,
    phone,
    fax,
    identityRedacted:
      privacyService ||
      (redactedFields.length > 0
        ? redactedFields.some((f) => f === "name" || f === "organization")
        : Boolean(c.redacted)),
    redactedFields,
    privacyService,
    // The summary row already shows the name (or organization) and the
    // "State, Country" line, so those alone are not "more".
    hasMore: Boolean(
      (name && distinctOrganization) ||
      organizationUnits.length ||
      c.kind ||
      title ||
      role ||
      email.length ||
      phone.length ||
      fax.length ||
      street.length ||
      poBox ||
      city ||
      postalCode,
    ),
  };
}

function hasContent(d: ContactDetails): boolean {
  return Boolean(
    d.name ||
    d.organization ||
    d.organizationUnits.length ||
    d.title ||
    d.role ||
    d.address.length ||
    d.email.length ||
    d.phone.length ||
    d.fax.length ||
    d.redactedFields.length,
  );
}

export function describeRegistrant(
  contacts: RegistrationContact[] | null | undefined,
  privacyEnabled?: boolean | null,
): RegistrantView | null {
  const registrantContact = contacts?.find((c) => c.type === "registrant");
  if (!registrantContact) return null;

  const registrant = describeContact(registrantContact);
  const others = (contacts ?? [])
    .filter((c) => c !== registrantContact && c.type !== "registrar" && c.type !== "unknown")
    .map(describeContact)
    .filter(hasContent);

  const name = registrant.organization ?? registrant.name;
  // `privacyEnabled` is coarse: rdapper sets it for any redacted registrant field
  // (an email-only redaction is the usual GDPR shape). Identity is only hidden
  // when no usable name survived, so a visible name stays a named registrant, and
  // a redacted country or email on its own doesn't hide anything.
  const redacted = !name && (Boolean(privacyEnabled) || registrant.identityRedacted);

  // Redaction wins even when a stray country is published.
  const state: RegistrantState = redacted
    ? "redacted"
    : name
      ? "named"
      : registrant.location
        ? "location-only"
        : "empty";

  const shown =
    hasContent(registrant) ||
    registrant.location ||
    registrant.privacyService ||
    registrant.redactedFields.length > 0
      ? registrant
      : undefined;

  return {
    state,
    name: redacted ? undefined : name,
    location: registrant.location,
    registrant: shown,
    others,
    hasDetails: Boolean(shown?.hasMore) || others.length > 0,
  };
}
