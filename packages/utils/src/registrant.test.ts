import { describe, expect, it } from "vitest";

import { describeRegistrant } from "./registrant";

describe("describeRegistrant", () => {
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

  it("shows location only, not 'Unknown', when no name is published (jarv.is case)", () => {
    const v = describeRegistrant([{ type: "registrant", country: "United States of America" }]);
    expect(v).toMatchObject({ state: "location-only", location: "United States of America" });
    expect(v?.name).toBeUndefined();
  });

  it("treats a NIC handle as no name", () => {
    const v = describeRegistrant([{ type: "registrant", name: "JJ1234-IS", country: "IS" }]);
    expect(v).toMatchObject({ state: "location-only", location: "Iceland" });
  });

  it("is empty when nothing usable is published", () => {
    const v = describeRegistrant([{ type: "registrant" }]);
    expect(v?.state).toBe("empty");
    expect(v?.registrant).toBeUndefined();
  });

  it("dedupes state equal to country and lists every email", () => {
    const v = describeRegistrant([
      {
        type: "registrant",
        name: "Jane Doe",
        state: "Iceland",
        country: "Iceland",
        email: ["jane@example.com", "jd@example.com"],
      },
    ]);
    expect(v?.location).toBe("Iceland");
    expect(v?.registrant?.email).toEqual(["jane@example.com", "jd@example.com"]);
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

  describe("redaction (as reported by rdapper)", () => {
    it("hides identity when rdapper dropped the name and flagged it", () => {
      const v = describeRegistrant([
        { type: "registrant", country: "US", redacted: true, redactedFields: ["name"] },
      ]);
      expect(v?.state).toBe("redacted");
      expect(v?.name).toBeUndefined();
    });

    it("honors privacyEnabled when no usable name is left", () => {
      expect(describeRegistrant([{ type: "registrant" }], true)?.state).toBe("redacted");
    });

    it("does not hide the identity when only other fields were redacted", () => {
      const v = describeRegistrant([
        { type: "registrant", redacted: true, redactedFields: ["country", "email"] },
      ]);
      expect(v).toMatchObject({ state: "empty" });
    });

    it("uses the contact-level flag when no name survives", () => {
      expect(describeRegistrant([{ type: "registrant", redacted: true }])?.state).toBe("redacted");
    });

    it("keeps a visible name named even when privacyEnabled is set (email-only redaction)", () => {
      const v = describeRegistrant(
        [
          {
            type: "registrant",
            name: "Jane Doe",
            country: "US",
            redacted: true,
            redactedFields: ["email", "phone"],
          },
        ],
        true,
      );
      expect(v).toMatchObject({ state: "named", name: "Jane Doe", location: "United States" });
      expect(v?.registrant?.redactedFields).toEqual(["email", "phone"]);
    });

    it("treats a privacy-service name as hidden but keeps the flag for the popover", () => {
      const v = describeRegistrant([
        { type: "registrant", organization: "Acme Proxy Services", privacyService: true },
      ]);
      expect(v).toMatchObject({ state: "redacted" });
      expect(v?.name).toBeUndefined();
      expect(v?.registrant?.privacyService).toBe(true);
    });
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
    });

    it("is false when the registrant only has redacted fields", () => {
      const v = describeRegistrant([
        { type: "registrant", name: "Jane Doe", redactedFields: ["email"] },
      ]);
      expect(v?.hasDetails).toBe(false);
    });

    it("is true when only another contact has content, even if the registrant is empty", () => {
      const v = describeRegistrant([
        { type: "registrant" },
        { type: "abuse", email: "abuse@example.com" },
      ]);
      expect(v).toMatchObject({ state: "empty", hasDetails: true });
    });
  });

  it("treats a two-letter country as a code (NA is Namibia)", () => {
    expect(describeRegistrant([{ type: "registrant", country: "NA" }])).toMatchObject({
      state: "location-only",
      location: "Namibia",
    });
  });
});
