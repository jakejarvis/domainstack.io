import { describe, expect, it } from "vitest";

import type { RegistrationContact } from "@domainstack/types";

import { upgradeContacts } from "./contacts";

describe("upgradeContacts", () => {
  const legacy: RegistrationContact = {
    type: "registrant",
    name: "REDACTED FOR PRIVACY",
    email: "Please query the RDDS service of the Registrar of Record",
    country: "N/A",
    state: "CA",
  };

  it("passes null and undefined through", () => {
    expect(upgradeContacts(null)).toBeNull();
    expect(upgradeContacts(undefined)).toBeUndefined();
  });

  it("drops placeholders from contacts stored by older rdapper versions and records them", () => {
    const [c] = upgradeContacts([legacy]);
    expect(c).toMatchObject({ type: "registrant", state: "CA", redacted: true });
    expect(c?.name).toBeUndefined();
    expect(c?.email).toBeUndefined();
    expect(c?.country).toBeUndefined();
    expect(c?.redactedFields).toEqual(expect.arrayContaining(["name", "email", "country"]));
  });

  it("flags privacy-service names but keeps the text", () => {
    const [c] = upgradeContacts([{ type: "registrant", organization: "Domains By Proxy, LLC" }]);
    expect(c).toMatchObject({ organization: "Domains By Proxy, LLC", privacyService: true });
  });

  it("is idempotent", () => {
    const once = upgradeContacts([legacy]);
    expect(upgradeContacts(once)).toEqual(once);
  });

  it("leaves clean contacts unchanged", () => {
    const clean: RegistrationContact = {
      type: "registrant",
      name: "Jane Doe",
      country: "United States",
      countryCode: "US",
    };
    expect(upgradeContacts([clean])).toEqual([clean]);
  });

  it("does not mutate its input", () => {
    const input: RegistrationContact[] = [structuredClone(legacy)];
    upgradeContacts(input);
    expect(input[0]).toEqual(legacy);
  });

  it("keeps Namibia's country code", () => {
    const [c] = upgradeContacts([{ type: "registrant", name: "Jane", country: "NA" }]);
    expect(c).toMatchObject({ country: "Namibia", countryCode: "NA" });
  });
});
