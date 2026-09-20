import { describe, expect, it } from "vitest";

import { describeRegistrant, isRedactedValue } from "./registrant";

describe("isRedactedValue", () => {
  it.each(["REDACTED FOR PRIVACY", "Data Protected", "Not Disclosed", "n/a", "-", "WHOIS Privacy"])(
    "flags %s",
    (v) => expect(isRedactedValue(v)).toBe(true),
  );
  it.each([
    "Jane Doe",
    "Acme Corp",
    "Protective Life Inc",
    "Private Equity Partners LLC",
    "Privacy Labs Inc",
    "ACME-CORP",
  ])("does not flag %s", (v) => expect(isRedactedValue(v)).toBe(false));
});

describe("describeRegistrant", () => {
  it("keeps legitimate names and 'Private'/'Privacy' street addresses", () => {
    const v = describeRegistrant([
      {
        type: "registrant",
        organization: "Private Equity Partners LLC",
        street: ["1 Private Rd"],
        city: "Privacy Falls",
      },
    ]);
    expect(v).toMatchObject({ state: "named", name: "Private Equity Partners LLC" });
    expect(v?.registrant?.address).toEqual(["1 Private Rd", "Privacy Falls"]);
  });

  it("does not treat an all-caps name as a NIC handle", () => {
    expect(describeRegistrant([{ type: "registrant", name: "ACME-CORP" }])?.name).toBe("ACME-CORP");
  });

  it("flags privacy-service names as redacted", () => {
    const v = describeRegistrant([{ type: "registrant", organization: "Domains By Proxy, LLC" }]);
    expect(v?.state).toBe("redacted");
  });

  it("returns null without a registrant contact", () => {
    expect(describeRegistrant([])).toBeNull();
    expect(describeRegistrant(undefined)).toBeNull();
    expect(describeRegistrant([{ type: "admin", name: "A" }])).toBeNull();
  });

  it("prefers organization over name", () => {
    const v = describeRegistrant([
      { type: "registrant", name: "Jane", organization: "Acme", state: "CA", country: "US" },
    ]);
    expect(v).toMatchObject({ state: "named", name: "Acme", location: "CA, United States" });
    expect(v?.registrant?.name).toBe("Jane");
  });

  it("shows location only, not 'Unknown', when no name (jarv.is case)", () => {
    const v = describeRegistrant([{ type: "registrant", country: "United States of America" }]);
    expect(v).toMatchObject({ state: "location-only", location: "United States of America" });
    expect(v?.name).toBeUndefined();
  });

  it("treats a NIC handle as no name", () => {
    const v = describeRegistrant([{ type: "registrant", name: "JJ1234-IS", country: "IS" }]);
    expect(v).toMatchObject({ state: "location-only", location: "Iceland" });
  });

  it("detects redaction from contact fields even without privacyEnabled", () => {
    const v = describeRegistrant([
      { type: "registrant", name: "REDACTED FOR PRIVACY", country: "US" },
    ]);
    expect(v?.state).toBe("redacted");
    expect(v?.name).toBeUndefined();
  });

  it("honors privacyEnabled when no usable name is left", () => {
    const v = describeRegistrant([{ type: "registrant", name: "REDACTED FOR PRIVACY" }], true);
    expect(v?.state).toBe("redacted");
    expect(describeRegistrant([{ type: "registrant" }], true)?.state).toBe("redacted");
  });

  it("keeps a visible name named even when privacyEnabled is set (email-only redaction)", () => {
    const v = describeRegistrant(
      [{ type: "registrant", name: "Jane Doe", country: "US", redacted: true }],
      true,
    );
    expect(v).toMatchObject({ state: "named", name: "Jane Doe", location: "United States" });
  });

  it("is empty when nothing usable is published", () => {
    const v = describeRegistrant([{ type: "registrant" }]);
    expect(v?.state).toBe("empty");
    expect(v?.registrant).toBeUndefined();
  });

  it("dedupes state equal to country and drops placeholder emails", () => {
    const v = describeRegistrant([
      {
        type: "registrant",
        name: "Jane Doe",
        state: "Iceland",
        country: "Iceland",
        email: ["Please query the RDDS service of the Registrar of Record", "jane@example.com"],
      },
    ]);
    expect(v?.location).toBe("Iceland");
    expect(v?.registrant?.email).toEqual(["jane@example.com"]);
  });

  it("includes other contacts that have content, excluding registrar", () => {
    const v = describeRegistrant([
      { type: "registrant", name: "Jane Doe" },
      { type: "abuse", email: "abuse@example.com" },
      { type: "tech" },
      { type: "registrar", name: "Reg" },
    ]);
    expect(v?.others.map((o) => o.type)).toEqual(["abuse"]);
  });

  it("uses rdapper's redacted flag when no name survives", () => {
    const v = describeRegistrant([{ type: "registrant", redacted: true, countryCode: "US" }]);
    expect(v?.state).toBe("redacted");
  });

  it("keeps a named registrant named when only other fields are redacted", () => {
    const v = describeRegistrant([{ type: "registrant", name: "Jane Doe", redacted: true }]);
    expect(v).toMatchObject({ state: "named", name: "Jane Doe" });
  });

  it("carries kind, title, org units and PO box for the popover", () => {
    const v = describeRegistrant([
      {
        type: "registrant",
        name: "Jane Doe",
        kind: "individual",
        title: "CTO",
        organizationUnits: ["Platform"],
        poBox: "12",
        city: "Reykjavik",
        countryCode: "IS",
      },
    ]);
    expect(v?.registrant).toMatchObject({
      kind: "individual",
      title: "CTO",
      organizationUnits: ["Platform"],
      address: ["PO Box 12", "Reykjavik", "Iceland"],
    });
  });

  it("treats a privacy-service name as hidden but keeps the flag for the popover", () => {
    const v = describeRegistrant([
      { type: "registrant", organization: "Acme Proxy Services", privacyService: true },
    ]);
    expect(v).toMatchObject({ state: "redacted" });
    expect(v?.name).toBeUndefined();
    expect(v?.registrant?.privacyService).toBe(true);
  });

  it("reports which fields the registry withheld", () => {
    const v = describeRegistrant([
      {
        type: "registrant",
        name: "Jane Doe",
        redacted: true,
        redactedFields: ["email", "phone"],
      },
    ]);
    expect(v).toMatchObject({ state: "named", name: "Jane Doe" });
    expect(v?.registrant?.redactedFields).toEqual(["email", "phone"]);
  });

  it("hides identity when rdapper dropped the name field", () => {
    const v = describeRegistrant(
      [{ type: "registrant", country: "US", redactedFields: ["name", "organization"] }],
      true,
    );
    expect(v?.state).toBe("redacted");
  });

  describe("hasDetails", () => {
    it("is false for name-only and location-only registrants", () => {
      expect(describeRegistrant([{ type: "registrant", name: "Jane Doe" }])?.hasDetails).toBe(
        false,
      );
      expect(
        describeRegistrant([{ type: "registrant", name: "Jane Doe", state: "CA", country: "US" }])
          ?.hasDetails,
      ).toBe(false);
      expect(describeRegistrant([{ type: "registrant", country: "US" }])?.hasDetails).toBe(false);
    });

    it("is true when the registrant has contact info, an address, or a second name", () => {
      const has = (c: object) =>
        describeRegistrant([{ type: "registrant", name: "Jane Doe", ...c }])?.hasDetails;
      expect(has({ email: "jane@example.com" })).toBe(true);
      expect(has({ street: ["1 Main St"] })).toBe(true);
      expect(has({ city: "Reykjavik" })).toBe(true);
      expect(has({ organization: "Acme Corp" })).toBe(true);
      expect(has({ title: "CTO" })).toBe(true);
      expect(has({ redactedFields: ["email"] })).toBe(true);
    });

    it("is true when only another contact has content, even if the registrant is empty", () => {
      const v = describeRegistrant([
        { type: "registrant" },
        { type: "abuse", email: "abuse@example.com" },
      ]);
      expect(v).toMatchObject({ state: "empty", hasDetails: true });
    });
  });

  describe("placeholder countries", () => {
    it.each(["N/A", "Unknown", "REDACTED FOR PRIVACY", "Not Disclosed"])(
      "drops %s instead of showing it as a location",
      (country) => {
        const v = describeRegistrant([{ type: "registrant", country }]);
        expect(v).toMatchObject({ state: "empty" });
        expect(v?.location).toBeUndefined();
      },
    );

    it("still treats two-letter NA as Namibia", () => {
      expect(describeRegistrant([{ type: "registrant", country: "NA" }])).toMatchObject({
        state: "location-only",
        location: "Namibia",
      });
    });
  });

  it("counts org units, title and role as content for other contacts", () => {
    const v = describeRegistrant([
      { type: "registrant", name: "Jane Doe" },
      { type: "tech", title: "Engineer" },
      { type: "admin", organizationUnits: ["Platform"] },
      { type: "billing", role: "Finance" },
      { type: "abuse", kind: "org" },
    ]);
    expect(v?.others.map((o) => o.type)).toEqual(["tech", "admin", "billing"]);
  });
});
