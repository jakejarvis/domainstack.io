import type { RegistrationContact } from "@domainstack/types";

/**
 * Interpret raw WHOIS/RDAP registrant contacts for display.
 *
 * Registries return wildly different shapes: names may be redacted placeholders,
 * NIC handles (e.g. `JJ1234-IS`), or missing entirely while the country is still
 * published. This normalizes all of that so the UI never has to invent "Unknown".
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
  redacted: boolean;
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
};

// Boilerplate a registry puts in place of real data. Safe to apply to any field.
const PLACEHOLDER_PATTERNS = [
  /redacted/i,
  /withheld/i,
  /not\s+(?:disclosed|available|applicable|published|public)/i,
  /data\s+protected/i,
  /gdpr/i,
  /statutory\s+masking/i,
  /\bmasked\b/i,
  /please\s+query\s+the\s+rdds/i,
  /select\s+request\s+email/i,
  /^(?:-|\.|n\/?a|no\s+data|none|unknown)$/i,
];

// Privacy-service names. Only meaningful for name/organization: "Private Equity
// Partners" or a "Privacy Road" address must not match, so these are phrases.
const PRIVACY_SERVICE_PATTERNS = [
  /(?:whois|domain|contact|identity|registration)\s+(?:privacy|protection)/i,
  /privacy\s+(?:service|protect|guard|shield)/i,
  /private\s+registration/i,
  /domains?\s+by\s+proxy/i,
  /(?:privacy|identity)\s+protected/i,
  /proxy\s+(?:service|registration)/i,
];

// NIC handles, e.g. "JJ1234-IS", "ABC123-RIPE", "AB1-NORID", "C12345678". Handles
// without digits are only recognized with a known registry suffix, so all-caps
// names like "ACME-CORP" survive.
const NIC_HANDLE =
  /^(?:[A-Z]{1,6}\d{1,10}-[A-Z]{2,8}|[A-Z0-9]{2,10}-(?:IS|RIPE|APNIC|AP|ARIN|NORID|SE|NL|DK|FI)|[A-Z]{1,3}\d{5,})$/;

/** Placeholder text in any field (email, phone, street, city, …). */
export function isPlaceholderValue(value: string | undefined | null): boolean {
  const v = value?.trim();
  return Boolean(v) && PLACEHOLDER_PATTERNS.some((re) => re.test(v as string));
}

/** Placeholder text or a privacy-service name, for name/organization fields. */
export function isRedactedValue(value: string | undefined | null): boolean {
  const v = value?.trim();
  if (!v) return false;
  return isPlaceholderValue(v) || PRIVACY_SERVICE_PATTERNS.some((re) => re.test(v));
}

function isHandle(value: string): boolean {
  return NIC_HANDLE.test(value.trim());
}

/** A value that can be shown to a human as a name/organization. */
function usableName(value: string | undefined | null): string | undefined {
  const v = value?.trim();
  if (!v || isRedactedValue(v) || isHandle(v)) return undefined;
  return v;
}

function toList(value: string | string[] | undefined): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map((v) => v.trim()).filter((v) => v && !isPlaceholderValue(v));
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
  const parts = [state && !isPlaceholderValue(state) ? state : undefined, country].filter(
    (p): p is string => Boolean(p),
  );
  const unique = parts.filter(
    (p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i,
  );
  return unique.length > 0 ? unique.join(", ") : undefined;
}

function describeContact(c: RegistrationContact): ContactDetails {
  const name = usableName(c.name);
  const organization = usableName(c.organization);
  const street = (c.street ?? []).map((s) => s.trim()).filter((s) => s && !isPlaceholderValue(s));
  const cityLine = [c.city, c.state, c.postalCode]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s) && !isPlaceholderValue(s));
  const country = formatCountry(c.country, c.countryCode);
  const poBox = c.poBox?.trim();
  const address = [
    ...(poBox && !isPlaceholderValue(poBox)
      ? [`PO Box ${poBox.replace(/^p\.?o\.?\s*box\s*/i, "")}`]
      : []),
    ...street,
    cityLine.join(", "),
    country ?? "",
  ].filter(Boolean);

  return {
    type: c.type,
    name,
    organization: organization && organization !== name ? organization : undefined,
    organizationUnits: (c.organizationUnits ?? [])
      .map((u) => u.trim())
      .filter((u) => u && !isPlaceholderValue(u)),
    kind: c.kind,
    title: usableName(c.title),
    role: usableName(c.role),
    address,
    location: formatLocation(c),
    email: toList(c.email),
    phone: toList(c.phone),
    fax: toList(c.fax),
    // rdapper >= 0.16 sets `redacted` and strips placeholders; the pattern check
    // covers contacts persisted by older versions.
    redacted: Boolean(c.redacted) || isRedactedValue(c.name) || isRedactedValue(c.organization),
  };
}

function hasContent(d: ContactDetails): boolean {
  return Boolean(
    d.name ||
    d.organization ||
    d.address.length ||
    d.email.length ||
    d.phone.length ||
    d.fax.length,
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
  // A contact-level flag only means identity is hidden when no name survived;
  // a redacted email next to a visible name is still a named registrant.
  const redacted = Boolean(privacyEnabled) || (registrant.redacted && !name);

  // Redaction wins even when a stray country is published.
  const state: RegistrantState = redacted
    ? "redacted"
    : name
      ? "named"
      : registrant.location
        ? "location-only"
        : "empty";

  return {
    state,
    name: redacted ? undefined : name,
    location: registrant.location,
    registrant: hasContent(registrant) || registrant.location ? registrant : undefined,
    others,
  };
}
