/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

vi.mock("@domainstack/edge-config", () => ({
  getProviderCatalog: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}));

const { getCachedRegistration } = await import("@domainstack/db/queries/registrations");
const { persistRegistration } = await import("./index");

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
});

describe("cached registration contacts", () => {
  it("brings contacts stored by older rdapper versions up to date on read", async () => {
    // Shape persisted before rdapper reported redactedFields: placeholder text in the fields.
    await persistRegistration("example.test", {
      domain: "example.test",
      tld: "test",
      isRegistered: true,
      status: "registered",
      source: "rdap",
      registrarProvider: { id: null, name: null, domain: null },
      contacts: [
        {
          type: "registrant",
          name: "REDACTED FOR PRIVACY",
          email: "Please query the RDDS service of the Registrar of Record",
          country: "US",
        },
      ],
    });

    const { data } = await getCachedRegistration("example.test");
    const [registrant] = data?.contacts ?? [];

    expect(registrant?.name).toBeUndefined();
    expect(registrant?.email).toBeUndefined();
    expect(registrant).toMatchObject({
      redacted: true,
      country: "United States",
      countryCode: "US",
    });
    expect(registrant?.redactedFields).toEqual(expect.arrayContaining(["name", "email"]));
  });

  it("returns clean contacts unchanged", async () => {
    const contacts = [
      {
        type: "registrant" as const,
        name: "Jane Doe",
        country: "United States",
        countryCode: "US",
      },
    ];
    await persistRegistration("example.test", {
      domain: "example.test",
      tld: "test",
      isRegistered: true,
      status: "registered",
      source: "rdap",
      registrarProvider: { id: null, name: null, domain: null },
      contacts,
    });

    const { data } = await getCachedRegistration("example.test");
    expect(data?.contacts).toEqual(contacts);
  });
});
