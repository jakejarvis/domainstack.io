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
  });

  it("dedupes state equal to country", () => {
    const v = describeRegistrant([
      {
        type: "registrant",
        name: "Jane Doe",
        state: "Iceland",
        country: "Iceland",
      },
    ]);
    expect(v?.location).toBe("Iceland");
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
    });

    it("treats a privacy-service name as hidden", () => {
      const v = describeRegistrant([
        { type: "registrant", organization: "Acme Proxy Services", privacyService: true },
      ]);
      expect(v).toMatchObject({ state: "redacted" });
      expect(v?.name).toBeUndefined();
    });
  });

  it("treats a two-letter country as a code (NA is Namibia)", () => {
    expect(describeRegistrant([{ type: "registrant", country: "NA" }])).toMatchObject({
      state: "location-only",
      location: "Namibia",
    });
  });
});
