import { toRegistrableDomain } from "@/lib/domain-server";
import {
  CA_PROVIDERS,
  DNS_PROVIDERS,
  EMAIL_PROVIDERS,
  HOSTING_PROVIDERS,
  REGISTRAR_PROVIDERS,
} from "@/lib/providers/catalog";
import type {
  DetectionContext,
  Header,
  Provider,
  ProviderRef,
  Rule,
} from "@/lib/schemas";

/**
 * A context object for header-based detection, pre-calculating values to
 * avoid redundant work in the loop.
 */
interface HeaderDetectionContext {
  headers: Header[];
  headerMap: Map<string, string>;
  headerNames: Set<string>;
}

/**
 * Create a detection context from HTTP headers for efficient rule evaluation.
 */
function createHeaderContext(headers: Header[]): HeaderDetectionContext {
  const headerMap = new Map<string, string>();
  const headerNames = new Set<string>();

  for (const header of headers) {
    const name = header.name.toLowerCase();
    const value = header.value.toLowerCase();
    headerMap.set(name, value);
    headerNames.add(name);
  }

  return { headers, headerMap, headerNames };
}

/**
 * Evaluate a single detection rule against the provided context.
 */
export function evalRule(rule: Rule, ctx: DetectionContext): boolean {
  const get = (name: string) => ctx.headers[name.toLowerCase()];
  const anyDns = (arr: string[], suf: string) =>
    arr.some((h) => h === suf || h.endsWith(`.${suf}`));
  const anyDnsRegex = (arr: string[], pattern: string, flags?: string) => {
    try {
      const re = new RegExp(pattern, flags ?? "i");
      return arr.some((h) => re.test(h));
    } catch {
      return false;
    }
  };

  if ("all" in rule) return rule.all.every((r) => evalRule(r, ctx));
  if ("any" in rule) return rule.any.some((r) => evalRule(r, ctx));
  if ("not" in rule) return !evalRule(rule.not, ctx);

  switch (rule.kind) {
    case "headerEquals": {
      const v = get(rule.name);
      return (
        typeof v === "string" && v.toLowerCase() === rule.value.toLowerCase()
      );
    }
    case "headerIncludes": {
      const v = get(rule.name);
      return (
        typeof v === "string" &&
        v.toLowerCase().includes(rule.substr.toLowerCase())
      );
    }
    case "headerPresent": {
      const key = rule.name.toLowerCase();
      return key in ctx.headers;
    }
    case "mxSuffix": {
      return anyDns(ctx.mx, rule.suffix.toLowerCase());
    }
    case "mxRegex": {
      return anyDnsRegex(ctx.mx, rule.pattern, rule.flags);
    }
    case "nsSuffix": {
      return anyDns(ctx.ns, rule.suffix.toLowerCase());
    }
    case "nsRegex": {
      return anyDnsRegex(ctx.ns, rule.pattern, rule.flags);
    }
    case "issuerEquals": {
      return !!ctx.issuer && ctx.issuer === rule.value.toLowerCase();
    }
    case "issuerIncludes": {
      return !!ctx.issuer?.includes(rule.substr.toLowerCase());
    }
    case "registrarEquals": {
      return !!ctx.registrar && ctx.registrar === rule.value.toLowerCase();
    }
    case "registrarIncludes": {
      return (
        !!ctx.registrar && ctx.registrar.includes(rule.substr.toLowerCase())
      );
    }
  }
}

/**
 * Detect a provider from a list of providers using the provided context.
 */
function detectProviderFromList(
  providers: Provider[],
  headerContext?: HeaderDetectionContext,
  mxHosts?: string[],
  nsHosts?: string[],
): ProviderRef {
  const headersObj: Record<string, string> = Object.fromEntries(
    (headerContext?.headers ?? []).map((h) => [
      h.name.toLowerCase(),
      h.value.trim().toLowerCase(),
    ]),
  );
  const ctx: DetectionContext = {
    headers: headersObj,
    mx: (mxHosts ?? []).map((h) => h.toLowerCase().replace(/\.$/, "")),
    ns: (nsHosts ?? []).map((h) => h.toLowerCase().replace(/\.$/, "")),
  };
  for (const provider of providers) {
    if (evalRule(provider.rule, ctx)) {
      return { name: provider.name, domain: provider.domain };
    }
  }
  return { name: null, domain: null };
}

/**
 * Detect hosting provider from HTTP headers.
 */
export function detectHostingProvider(headers: Header[]): ProviderRef {
  const context = createHeaderContext(headers);
  return detectProviderFromList(HOSTING_PROVIDERS, context);
}

/**
 * Detect email provider from MX records.
 */
export function detectEmailProvider(mxHosts: string[]): ProviderRef {
  const found = detectProviderFromList(EMAIL_PROVIDERS, undefined, mxHosts);
  if (found.name) return found;
  const first = mxHosts[0];
  if (first) {
    const root = toRegistrableDomain(first);
    return { name: root || first, domain: root || null };
  }
  return { name: null, domain: null };
}

/**
 * Detect DNS provider from NS records.
 */
export function detectDnsProvider(nsHosts: string[]): ProviderRef {
  const found = detectProviderFromList(
    DNS_PROVIDERS,
    undefined,
    undefined,
    nsHosts,
  );
  if (found.name) return found;
  const first = nsHosts[0];
  if (first) {
    const root = toRegistrableDomain(first);
    return { name: root || first, domain: root || null };
  }
  return { name: null, domain: null };
}

/** Detect registrar provider from registrar name */
export function detectRegistrar(registrarName: string): ProviderRef {
  const name = (registrarName || "").toLowerCase();
  if (!name) return { name: null, domain: null };
  const ctx: DetectionContext = {
    headers: {},
    mx: [],
    ns: [],
    issuer: undefined,
    registrar: name,
  };
  for (const reg of REGISTRAR_PROVIDERS) {
    if (evalRule(reg.rule, ctx)) return { name: reg.name, domain: reg.domain };
  }
  return { name: null, domain: null };
}

/** Detect certificate authority from an issuer string */
export function detectCertificateAuthority(issuer: string): ProviderRef {
  const name = (issuer || "").toLowerCase();
  if (!name) return { name: null, domain: null };
  const ctx: DetectionContext = { headers: {}, mx: [], ns: [], issuer: name };
  for (const ca of CA_PROVIDERS) {
    if (evalRule(ca.rule, ctx)) {
      return { name: ca.name, domain: ca.domain };
    }
  }
  return { name: null, domain: null };
}
