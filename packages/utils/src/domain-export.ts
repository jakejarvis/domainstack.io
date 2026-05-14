import type { DomainResponse } from "@domainstack/types";

/**
 * Build the JSON payload exported from the domain report. Trims internal
 * provider IDs and presentation-only fields so the output is meaningful to
 * a human reading the file. Delivery (download on web, share sheet on
 * native) is left to the caller.
 */
export function serializeDomainExport(domain: string, data: Partial<DomainResponse>) {
  let registration = null;
  if (data.registration) {
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
      const { caProvider: _cp, ...rest } = c;
      return rest;
    });
  }

  const headers = data.headers ? data.headers.headers : null;

  let seo = null;
  if (data.seo) {
    const { preview: _p, source: _s, errors: _e, ...rest } = data.seo;
    seo = rest;
  }

  return {
    domain,
    registration,
    dns,
    hosting,
    certificates,
    headers,
    seo,
  };
}

export type SerializedDomainExport = ReturnType<typeof serializeDomainExport>;
