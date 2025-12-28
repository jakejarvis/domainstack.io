import type {
  CertificatesResponse,
  DnsRecordsResponse,
  HeadersResponse,
  HostingResponse,
  RegistrationResponse,
  SeoResponse,
} from "@/lib/schemas";

export function exportDomainData(
  domain: string,
  data: Record<string, unknown>,
) {
  // Manual transformation to remove Zod dependency
  const registration = data.registration as RegistrationResponse | null;
  const dns = data.dns as DnsRecordsResponse | null;
  const hosting = data.hosting as HostingResponse | null;
  const certificates = data.certificates as CertificatesResponse | null;
  const headers = data.headers as HeadersResponse | null;
  const seo = data.seo as SeoResponse | null;

  let cleanedRegistration = null;
  if (registration) {
    // omit domain, unicodeName, punycodeName, warnings, registrarProvider
    const {
      domain: _d,
      unicodeName: _u,
      punycodeName: _p,
      warnings: _w,
      registrarProvider: _rp,
      ...rest
    } = registration;
    cleanedRegistration = rest;
  }

  let cleanedDns = null;
  if (dns) {
    cleanedDns = {
      records: dns.records?.map((r) => {
        // omit isCloudflare
        const { isCloudflare: _ic, ...rest } = r;
        return rest;
      }),
      resolver: dns.resolver,
    };
  }

  let cleanedHosting = null;
  if (hosting) {
    cleanedHosting = {
      dns: hosting.dnsProvider?.name ?? "",
      hosting: hosting.hostingProvider?.name ?? "",
      email: hosting.emailProvider?.name ?? "",
      geo: hosting.geo,
    };
  }

  let cleanedCertificates = null;
  if (certificates?.certificates) {
    cleanedCertificates = certificates.certificates.map((c) => {
      // omit caProvider
      const { caProvider: _cp, ...rest } = c;
      return rest;
    });
  }

  let cleanedHeaders = null;
  if (headers) {
    cleanedHeaders = headers.headers;
  }

  let cleanedSeo = null;
  if (seo) {
    // omit preview, source, errors
    const { preview: _p, source: _s, errors: _e, ...rest } = seo;
    cleanedSeo = rest;
  }

  const payload = {
    domain,
    registration: cleanedRegistration,
    dns: cleanedDns,
    hosting: cleanedHosting,
    certificates: cleanedCertificates,
    headers: cleanedHeaders,
    seo: cleanedSeo,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  // create a download "link" for a new imaginary json file
  const a = document.createElement("a");
  a.href = url;
  a.download = `${domain}-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
