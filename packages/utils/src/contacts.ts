import { finalizeContact } from "rdapper";

import type { RegistrationContact } from "@domainstack/types";

/**
 * Re-run rdapper's contact post-processing over contacts read back from storage.
 *
 * rdapper already finalizes contacts on lookup (dropping placeholder text, recording
 * `redactedFields`/`privacyService`, resolving countries). Rows persisted by earlier
 * rdapper versions predate that, so their placeholders are still in the data. It is
 * idempotent, so already-clean contacts pass through unchanged.
 *
 * Server-only: rdapper's entry point pulls in the Public Suffix List. Client code
 * should rely on the flags this sets, not import rdapper (see `./registrant`).
 * Can be removed once every stored row has been refreshed by rdapper >= 0.16.2.
 */
export function upgradeContacts(contacts: RegistrationContact[]): RegistrationContact[];
export function upgradeContacts(
  contacts: RegistrationContact[] | null,
): RegistrationContact[] | null;
export function upgradeContacts(
  contacts: RegistrationContact[] | null | undefined,
): RegistrationContact[] | null | undefined;
export function upgradeContacts(
  contacts: RegistrationContact[] | null | undefined,
): RegistrationContact[] | null | undefined {
  if (!contacts) return contacts;
  // finalizeContact mutates its argument, so hand it a copy of each stored contact.
  return contacts.map((c) => finalizeContact(structuredClone(c)));
}
