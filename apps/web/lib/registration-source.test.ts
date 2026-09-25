import { describe, expect, it } from "vitest";

import { describeRegistrationSource } from "@/lib/registration-source";

describe("describeRegistrationSource", () => {
  it("uses the last RDAP server in the chain, named by hostname", () => {
    expect(
      describeRegistrationSource({
        rdapServers: ["https://rdap.iana.org/", "https://rdap.verisign.com/com/v1/"],
        whoisServer: "whois.verisign-grs.com",
        source: "rdap",
      }),
    ).toEqual({
      serverUrl: "https://rdap.verisign.com/com/v1/",
      serverName: "rdap.verisign.com",
      learnUrl: "https://about.rdap.org/",
      sourceLabel: "RDAP",
    });
  });

  it("accepts a bare host and falls back to RDAP when it can't be parsed", () => {
    expect(describeRegistrationSource({ rdapServers: ["rdap.nic.io"] }).serverName).toBe(
      "rdap.nic.io",
    );
    expect(describeRegistrationSource({ rdapServers: ["https://"] }).serverName).toBe("RDAP");
  });

  it("names the WHOIS server, or WHOIS, without an RDAP chain", () => {
    expect(
      describeRegistrationSource({
        rdapServers: [],
        whoisServer: "whois.nic.dev",
        source: "whois",
      }),
    ).toEqual({
      serverUrl: undefined,
      serverName: "whois.nic.dev",
      learnUrl: "https://en.wikipedia.org/wiki/WHOIS",
      sourceLabel: "WHOIS",
    });
    expect(describeRegistrationSource({ rdapServers: null, whoisServer: null }).serverName).toBe(
      "WHOIS",
    );
  });
});
