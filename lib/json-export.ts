import type { DomainResponse } from "@/lib/types/domain/domain-response";

export function exportDomainData(
  domain: string,
  data: Partial<DomainResponse>,
) {
  let registration = null;
  if (data.registration) {
    // omit domain, unicodeName, punycodeName, warnings, registrarProvider
    const {
      domain: _d,
      unicodeName: _u,
      punycodeName: _p,
      warnings: _w,
      registrarProvider: _rp,
      ...rest
    } = data.registration;
    registration = rest;
  }

  let dns = null;
  if (data.dns) {
    dns = {
      records: data.dns.records?.map((r) => {
        // omit isCloudflare
        const { isCloudflare: _ic, ...rest } = r;
        return rest;
      }),
      resolver: data.dns.resolver,
    };
  }

  let hosting = null;
  if (data.hosting) {
    hosting = {
      dns: data.hosting.dnsProvider?.name ?? "",
      hosting: data.hosting.hostingProvider?.name ?? "",
      email: data.hosting.emailProvider?.name ?? "",
      geo: data.hosting.geo,
    };
  }

  let certificates = null;
  if (data.certificates?.certificates) {
    certificates = data.certificates.certificates.map((c) => {
      // omit caProvider
      const { caProvider: _cp, ...rest } = c;
      return rest;
    });
  }

  let headers = null;
  if (data.headers) {
    // biome-ignore lint/nursery/useDestructuring: might be null
    headers = data.headers.headers;
  }

  let seo = null;
  if (data.seo) {
    // omit preview, source, errors
    const { preview: _p, source: _s, errors: _e, ...rest } = data.seo;
    seo = rest;
  }

  const payload = {
    domain,
    registration,
    dns,
    hosting,
    certificates,
    headers,
    seo,
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
