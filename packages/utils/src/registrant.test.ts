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

  it("honors privacyEnabled", () => {
    const v = describeRegistrant([{ type: "registrant", name: "Jane" }], true);
    expect(v?.state).toBe("redacted");
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
});
