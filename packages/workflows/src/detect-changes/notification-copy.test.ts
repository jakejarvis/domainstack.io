import { describe, expect, it } from "vitest";

import type {
  CertificateChangeWithNames,
  ProviderChangeWithNames,
  RegistrationChange,
} from "@domainstack/types";

import {
  describeCertificateChange,
  describeProviderChange,
  describeRegistrationChange,
  describeUnregistered,
} from "./notification-copy";

const noRegistrationChange: RegistrationChange = {
  registrarChanged: false,
  nameserversChanged: false,
  transferLockChanged: false,
  statusesChanged: false,
  previousRegistrar: null,
  previousNameservers: [],
  previousTransferLock: null,
  previousStatuses: [],
  newRegistrar: null,
  newNameservers: [],
  newTransferLock: null,
  newStatuses: [],
};

const noProviderChange: ProviderChangeWithNames = {
  dnsProviderChanged: false,
  hostingProviderChanged: false,
  emailProviderChanged: false,
  previousDnsProviderId: null,
  previousHostingProviderId: null,
  previousEmailProviderId: null,
  newDnsProviderId: null,
  newHostingProviderId: null,
  newEmailProviderId: null,
  previousDnsProvider: null,
  previousHostingProvider: null,
  previousEmailProvider: null,
  newDnsProvider: null,
  newHostingProvider: null,
  newEmailProvider: null,
};

const noCertificateChange: CertificateChangeWithNames = {
  kind: "renewal",
  caProviderChanged: false,
  issuerChanged: false,
  previousCaProviderId: null,
  previousIssuer: null,
  newCaProviderId: null,
  newIssuer: null,
  previousCaProvider: null,
  newCaProvider: null,
};

describe("describeRegistrationChange", () => {
  it("titles by the most significant change and lists every detail", () => {
    const copy = describeRegistrationChange(
      {
        ...noRegistrationChange,
        registrarChanged: true,
        nameserversChanged: true,
        statusesChanged: true,
        previousRegistrar: "Namecheap",
        newRegistrar: "Cloudflare",
        previousNameservers: [{ host: "a.ns" }],
        newNameservers: [{ host: "x.ns" }, { host: "y.ns" }, { host: "z.ns" }],
        previousStatuses: ["clientTransferProhibited"],
        newStatuses: ["serverHold"],
      },
      "example.com",
    );

    expect(copy).toEqual({
      title: "Registrar changed for example.com",
      message:
        "Registrar changed from Namecheap to Cloudflare. Nameservers changed to x.ns, y.ns (+1 more). Status added: serverHold. Status removed: clientTransferProhibited.",
      emailSubject: "⚠️ Registrar changed for example.com",
    });
  });

  it("describes a registrar removal and a transfer lock change", () => {
    const copy = describeRegistrationChange(
      {
        ...noRegistrationChange,
        registrarChanged: true,
        transferLockChanged: true,
        previousRegistrar: "Namecheap",
        newTransferLock: false,
      },
      "example.com",
    );

    expect(copy.message).toBe("Registrar Namecheap removed. Transfer lock disabled.");
  });

  it("falls back to a generic message when nothing describable changed", () => {
    expect(describeRegistrationChange(noRegistrationChange, "example.com")).toEqual({
      title: "Registration changed for example.com",
      message: "Registration details updated for example.com.",
      emailSubject: "⚠️ Registration changed for example.com",
    });
  });
});

describe("describeUnregistered", () => {
  it("mentions the previous registrar when known", () => {
    expect(describeUnregistered("example.com", "Namecheap").message).toBe(
      "The registry reports example.com as unregistered (previously registered with Namecheap). If this is unexpected, contact your registrar immediately.",
    );
    expect(describeUnregistered("example.com", null).emailSubject).toBe(
      "🚨 example.com is no longer registered",
    );
  });
});

describe("describeProviderChange", () => {
  it("describes each changed provider, titled by the first in priority order", () => {
    const copy = describeProviderChange(
      {
        ...noProviderChange,
        hostingProviderChanged: true,
        emailProviderChanged: true,
        previousHostingProvider: "Netlify",
        newHostingProvider: "Vercel",
        previousEmailProvider: "Google Workspace",
      },
      "example.com",
    );

    expect(copy).toEqual({
      title: "Hosting changed for example.com",
      message: "Hosting changed from Netlify to Vercel. Email provider Google Workspace removed.",
      emailSubject: "🔄 Hosting changed for example.com",
    });
  });
});

describe("describeCertificateChange", () => {
  it("reports only the new expiry for a renewal", () => {
    expect(
      describeCertificateChange(
        "renewal",
        noCertificateChange,
        "2027-03-04T00:00:00.000Z",
        "example.com",
      ),
    ).toEqual({
      title: "Certificate renewed for example.com",
      message: "Valid until March 4, 2027.",
      emailSubject: "🔒 Certificate renewed for example.com",
    });
  });

  it("lists authority and issuer swaps before the expiry", () => {
    const copy = describeCertificateChange(
      "authority",
      {
        ...noCertificateChange,
        kind: "authority",
        caProviderChanged: true,
        issuerChanged: true,
        previousCaProvider: "Let's Encrypt",
        newCaProvider: "Google Trust Services",
        newIssuer: "WE1",
      },
      "not-a-date",
      "example.com",
    );

    expect(copy.title).toBe("Certificate authority changed for example.com");
    expect(copy.message).toBe(
      "Certificate authority changed from Let's Encrypt to Google Trust Services. Issuer set to WE1. Valid until not-a-date.",
    );
  });
});
